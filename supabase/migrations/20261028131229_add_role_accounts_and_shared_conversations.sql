CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  role text NOT NULL CHECK (role IN ('worker', 'support', 'client')),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX profiles_one_worker_role_idx
  ON public.profiles (role)
  WHERE role = 'worker';
CREATE UNIQUE INDEX profiles_one_support_role_idx
  ON public.profiles (role)
  WHERE role = 'support';
CREATE UNIQUE INDEX profiles_one_client_role_idx
  ON public.profiles (role)
  WHERE role = 'client';

CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL CHECK (room IN ('client', 'support')),
  worker_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_distinct_users CHECK (worker_id <> participant_id),
  CONSTRAINT chat_conversations_unique_room UNIQUE (room, worker_id, participant_id)
);

DROP POLICY IF EXISTS "Users can read their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send their own chat messages" ON public.chat_messages;
ALTER TABLE public.chat_messages RENAME COLUMN user_id TO worker_id;
ALTER INDEX public.chat_messages_user_room_created_at_idx
  RENAME TO chat_messages_worker_room_created_at_idx;

REVOKE ALL ON TABLE public.chat_messages FROM anon, authenticated, public;
REVOKE INSERT (worker_id, room, sender, body) ON TABLE public.chat_messages FROM authenticated;
GRANT SELECT ON TABLE public.chat_messages TO authenticated;
GRANT INSERT (worker_id, room, sender, body) ON TABLE public.chat_messages TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.profiles TO authenticated;

CREATE POLICY "Users can read their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_conversations FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.chat_conversations TO authenticated;

CREATE POLICY "Conversation participants can read their conversations"
  ON public.chat_conversations
  FOR SELECT
  TO authenticated
  USING (worker_id = (SELECT auth.uid()) OR participant_id = (SELECT auth.uid()));

CREATE POLICY "Conversation participants can read chat messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations AS conversation
      WHERE conversation.worker_id = chat_messages.worker_id
        AND conversation.room = chat_messages.room
        AND (
          conversation.worker_id = (SELECT auth.uid())
          OR conversation.participant_id = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "Conversation participants can send chat messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_conversations AS conversation
      WHERE conversation.worker_id = chat_messages.worker_id
        AND conversation.room = chat_messages.room
        AND (
          (conversation.worker_id = (SELECT auth.uid()) AND chat_messages.sender = 'me')
          OR (conversation.participant_id = (SELECT auth.uid()) AND chat_messages.sender = 'them')
        )
    )
  );

CREATE FUNCTION public.sync_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  username_value text;
  role_value text;
  display_name_value text;
BEGIN
  username_value := lower(
    coalesce(
      NEW.raw_app_meta_data ->> 'username',
      NEW.raw_user_meta_data ->> 'username',
      split_part(coalesce(NEW.email, ''), '@', 1)
    )
  );
  username_value := left(regexp_replace(username_value, '[^a-z0-9_]', '_', 'g'), 32);
  IF length(username_value) < 3 THEN
    username_value := 'user_' || left(NEW.id::text, 8);
  END IF;

  role_value := NEW.raw_app_meta_data ->> 'role';
  IF role_value IS NULL OR role_value NOT IN ('worker', 'support', 'client') THEN
    role_value := CASE username_value
      WHEN 'support' THEN 'support'
      WHEN 'hal' THEN 'client'
      ELSE 'worker'
    END;
  END IF;

  display_name_value := coalesce(
    nullif(NEW.raw_user_meta_data ->> 'display_name', ''),
    CASE role_value
      WHEN 'support' THEN 'Support'
      WHEN 'client' THEN 'Hal'
      ELSE 'Worker'
    END
  );

  INSERT INTO public.profiles (user_id, username, role, display_name)
  VALUES (NEW.id, username_value, role_value, display_name_value)
  ON CONFLICT (user_id) DO UPDATE
    SET username = EXCLUDED.username,
        role = EXCLUDED.role,
        display_name = EXCLUDED.display_name;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_profile_after_auth_user_change
  AFTER INSERT OR UPDATE OF raw_app_meta_data, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_from_auth_user();

CREATE FUNCTION public.create_chat_conversations_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  worker_user_id uuid;
  other_profile record;
BEGIN
  IF NEW.role = 'worker' THEN
    FOR other_profile IN
      SELECT user_id, role
      FROM public.profiles
      WHERE role IN ('support', 'client')
    LOOP
      INSERT INTO public.chat_conversations (room, worker_id, participant_id)
      VALUES (other_profile.role, NEW.user_id, other_profile.user_id)
      ON CONFLICT (room, worker_id, participant_id) DO NOTHING;
    END LOOP;
  ELSE
    SELECT user_id
    INTO worker_user_id
    FROM public.profiles
    WHERE role = 'worker'
    LIMIT 1;

    IF worker_user_id IS NOT NULL THEN
      INSERT INTO public.chat_conversations (room, worker_id, participant_id)
      VALUES (NEW.role, worker_user_id, NEW.user_id)
      ON CONFLICT (room, worker_id, participant_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_chat_conversations_after_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_chat_conversations_for_profile();

INSERT INTO public.profiles (user_id, username, role, display_name)
SELECT
  auth_user.id,
  left(
    regexp_replace(
      lower(coalesce(
        auth_user.raw_app_meta_data ->> 'username',
        auth_user.raw_user_meta_data ->> 'username',
        split_part(coalesce(auth_user.email, ''), '@', 1)
      )),
      '[^a-z0-9_]', '_', 'g'
    ),
    32
  ),
  CASE coalesce(auth_user.raw_app_meta_data ->> 'role', '')
    WHEN 'worker' THEN 'worker'
    WHEN 'support' THEN 'support'
    WHEN 'client' THEN 'client'
    ELSE CASE lower(split_part(coalesce(auth_user.email, ''), '@', 1))
      WHEN 'support' THEN 'support'
      WHEN 'hal' THEN 'client'
      ELSE 'worker'
    END
  END,
  coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'display_name', ''),
    CASE coalesce(auth_user.raw_app_meta_data ->> 'role', '')
      WHEN 'support' THEN 'Support'
      WHEN 'client' THEN 'Hal'
      ELSE 'Worker'
    END
  )
FROM auth.users AS auth_user
ON CONFLICT (user_id) DO NOTHING;

REVOKE ALL ON FUNCTION public.sync_profile_from_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_chat_conversations_for_profile() FROM PUBLIC, anon, authenticated;

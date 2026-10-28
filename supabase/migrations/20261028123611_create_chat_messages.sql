CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  room text NOT NULL CHECK (room IN ('client', 'support')),
  sender text NOT NULL CHECK (sender IN ('me', 'them')),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_user_room_created_at_idx
  ON public.chat_messages (user_id, room, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_messages FROM anon, public;
GRANT SELECT ON TABLE public.chat_messages TO authenticated;
GRANT INSERT (user_id, room, sender, body) ON TABLE public.chat_messages TO authenticated;

CREATE POLICY "Users can read their own chat messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own chat messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END;
$$;

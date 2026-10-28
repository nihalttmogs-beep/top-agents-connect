DROP POLICY "Users can insert their own chat messages" ON public.chat_messages;

CREATE POLICY "Users can send their own chat messages"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND sender = 'me');

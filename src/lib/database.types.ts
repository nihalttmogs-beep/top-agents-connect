export type ChatRoom = "client" | "support";
export type ChatSender = "me" | "them";

export type Database = {
  public: {
    Tables: {
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          room: ChatRoom;
          sender: ChatSender;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          room: ChatRoom;
          sender: ChatSender;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          room?: ChatRoom;
          sender?: ChatSender;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];

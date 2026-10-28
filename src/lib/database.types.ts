export type AccountRole = "worker" | "support" | "client";
export type ChatRoom = "client" | "support";
export type ChatSender = "me" | "them";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          username: string;
          role: AccountRole;
          display_name: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          username: string;
          role: AccountRole;
          display_name: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          username?: string;
          role?: AccountRole;
          display_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_conversations: {
        Row: {
          id: string;
          room: ChatRoom;
          worker_id: string;
          participant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room: ChatRoom;
          worker_id: string;
          participant_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room?: ChatRoom;
          worker_id?: string;
          participant_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          worker_id: string;
          room: ChatRoom;
          sender: ChatSender;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          room: ChatRoom;
          sender: ChatSender;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
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

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ChatConversationRow = Database["public"]["Tables"]["chat_conversations"]["Row"];
export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];

export type User = {
  id: number;
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  account_type: "organizer" | "attendee";
};

export type EventStatus = "draft" | "published" | "ended" | "archived";

export type EventData = {
  id: string;
  organization?: string | null;
  name: string;
  slug: string;
  description: string;
  timezone: string;
  starts_at: string;
  ends_at: string;
  status?: EventStatus;
  access_mode: "public" | "registration" | "invite";
  registration_open: boolean;
  public_config: Record<string, unknown>;
  branding: Record<string, unknown>;
  feature_flags: Record<string, boolean>;
  rooms?: Room[];
  sessions?: Session[];
  recordings?: Recording[];
};

export type Room = {
  id: string;
  event?: string;
  name: string;
  description: string;
  mode: "event" | "meeting";
  capacity: number | null;
  position: number;
  module_config?: Array<{ type: string; config: Record<string, unknown> }>;
  zoom_session?: ZoomSession | null;
};

export type ZoomSession = {
  id: number;
  room?: string;
  session_name?: string;
  passcode?: string;
  configured: boolean;
  is_live: boolean;
  live_started_at?: string | null;
  live_ended_at?: string | null;
  host_last_seen_at?: string | null;
};

export type StageInvitation = {
  id: number;
  user: number | null;
  registration: string | null;
  status: "pending" | "accepted" | "revoked";
  allow_audio: boolean;
  allow_video: boolean;
  allow_screen_share: boolean;
};

export type ParticipantDirectoryEntry = {
  identity: string;
  name: string;
  email: string;
};

export type ZoomJoinResponse = {
  token: string;
  session_name: string;
  session_passcode: string;
  user_name: string;
  role: "host" | "participant" | "viewer";
  room_mode: "event" | "meeting";
  can_interact: boolean;
  media_permissions: { audio: boolean; video: boolean; screen_share: boolean };
  stage_invitation: StageInvitation | null;
  stage_invitations: StageInvitation[];
  participant_directory: ParticipantDirectoryEntry[];
};

export type CaptionLanguage = "pt-BR" | "en-US";

export type LiveCaption = {
  id: string;
  zoom_session: number;
  speaker_identity: string;
  speaker_name: string;
  source_language: CaptionLanguage;
  original_text: string;
  translations: Record<CaptionLanguage, string>;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string;
  custom_domain: string | null;
  branding: Record<string, string>;
  feature_flags: Record<string, boolean>;
  events: EventData[];
};

export type Speaker = {
  id: string;
  event: string;
  name: string;
  email: string;
  bio: string;
  avatar_url: string;
};

export type Session = {
  id: string;
  event: string;
  room: string | null;
  speakers: string[];
  speakers_detail: Speaker[];
  title: string;
  slug: string;
  description: string;
  starts_at: string;
  ends_at: string;
  status: "draft" | "published" | "cancelled";
  track: string;
  tags: string[];
};

export type Registration = {
  id: string;
  event: string;
  user: number | null;
  email: string;
  name: string;
  status: "pending" | "confirmed" | "cancelled" | "blocked";
  ticket_code: string;
  profile: Record<string, string>;
  created_at: string;
};

export type Recording = {
  id: string;
  event: string;
  room: string | null;
  session: string | null;
  title: string;
  provider: string;
  provider_id: string;
  playback_url: string;
  duration_seconds: number | null;
  status: "processing" | "available" | "failed" | "hidden";
  published_at: string | null;
};

export type Analytics = {
  event_id: string;
  generated_at: string;
  registrations: number;
  confirmed_registrations: number;
  unique_viewers: number;
  total_visits: number;
  chat_messages: number;
  questions: number;
  rooms: Array<{
    room_id: string;
    room_name: string;
    unique_viewers: number;
    visits: number;
    average_duration: string | null;
    chat_messages: number;
    questions: number;
  }>;
};

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type ChatChannel = { id: string; event: string; room: string | null; name: string };
export type ChatMessage = { id: string; body: string; sender: (Partial<User> & { id: number; name?: string }) | null; created_at: string };
export type Question = { id: string; content: string; score: number; voted: boolean; state: string; answered: boolean };
export type PollOption = { id: string; text: string; position: number; votes: number | null };
export type Poll = { id: string; question: string; state: string; options: PollOption[]; total_votes: number | null };

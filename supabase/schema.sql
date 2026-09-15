-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.categorias (
  id smallint NOT NULL DEFAULT nextval('categorias_id_seq'::regclass),
  nombre text NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  orden smallint NOT NULL DEFAULT 0,
  CONSTRAINT categorias_pkey PRIMARY KEY (id)
);
CREATE TABLE public.personas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email USER-DEFINED NOT NULL UNIQUE,
  nombre text,
  departamento text,
  es_agente boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  auth_user_id uuid UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT personas_pkey PRIMARY KEY (id),
  CONSTRAINT personas_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tickets (
  id bigint NOT NULL DEFAULT nextval('tickets_id_seq'::regclass),
  ref text DEFAULT ('PANDO-'::text || (id)::text),
  titulo text NOT NULL,
  descripcion text,
  solicitante_id uuid NOT NULL,
  agente_id uuid,
  categoria_id smallint,
  prioridad USER-DEFINED NOT NULL DEFAULT 'normal'::prioridad_t,
  estado USER-DEFINED NOT NULL DEFAULT 'nuevo'::estado_t,
  origen text NOT NULL DEFAULT 'email'::text,
  conversation_id text,
  bloquea_trabajo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  triaged_at timestamp with time zone,
  first_response_at timestamp with time zone,
  resolved_at timestamp with time zone,
  closed_at timestamp with time zone,
  reopened_at timestamp with time zone,
  reopen_count smallint NOT NULL DEFAULT 0,
  due_at timestamp with time zone,
  espera_segundos integer NOT NULL DEFAULT 0,
  espera_desde timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.personas(id),
  CONSTRAINT tickets_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id),
  CONSTRAINT tickets_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.personas(id)
);
CREATE TABLE public.messages (
  id bigint NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  ticket_id bigint NOT NULL,
  direccion text NOT NULL CHECK (direccion = ANY (ARRAY['entrante'::text, 'saliente'::text])),
  autor_id uuid,
  cuerpo_texto text NOT NULL,
  cuerpo_html text,
  es_nota_interna boolean NOT NULL DEFAULT false,
  graph_message_id text UNIQUE,
  enviado_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT messages_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.personas(id)
);
CREATE TABLE public.attachments (
  id bigint NOT NULL DEFAULT nextval('attachments_id_seq'::regclass),
  message_id bigint NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes integer,
  storage_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attachments_pkey PRIMARY KEY (id),
  CONSTRAINT attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id)
);
CREATE TABLE public.events (
  id bigint NOT NULL DEFAULT nextval('events_id_seq'::regclass),
  ticket_id bigint NOT NULL,
  tipo text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  actor_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.personas(id)
);
CREATE TABLE public.email_ingesta (
  id bigint NOT NULL DEFAULT nextval('email_ingesta_id_seq'::regclass),
  graph_message_id text NOT NULL UNIQUE,
  remitente text,
  asunto text,
  resultado text NOT NULL,
  motivo text,
  ticket_id bigint,
  recibido_at timestamp with time zone,
  procesado_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_ingesta_pkey PRIMARY KEY (id),
  CONSTRAINT email_ingesta_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id)
);
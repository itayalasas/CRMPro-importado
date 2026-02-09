-- Tabla de comentarios de ticket
CREATE TABLE IF NOT EXISTS ticket_comments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_system BOOLEAN DEFAULT FALSE
);

-- Tabla de historial de ticket
CREATE TABLE IF NOT EXISTS ticket_history (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id),
    old_status VARCHAR(32),
    new_status VARCHAR(32),
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id);
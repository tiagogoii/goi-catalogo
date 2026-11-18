-- Motos del catálogo. Las listas (versiones y precios, ficha técnica, características, colores, fotos) se guardan como texto JSON.
CREATE TABLE models (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT '',        -- tipo según Honda (Cub, Scooter, Sport…): se ve en la etiqueta de la tarjeta
  uso TEXT NOT NULL DEFAULT '',            -- grupo del filtro de la portada (Ciudad, Aventura…)
  tagline TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',      -- miniatura de Honda
  photo_url TEXT NOT NULL DEFAULT '',      -- foto principal elegida en el panel (tiene prioridad)
  hero_url TEXT NOT NULL DEFAULT '',
  price_valid_to TEXT NOT NULL DEFAULT '', -- AAAA-MM-DD; vacío = el precio no vence
  versions_json TEXT NOT NULL DEFAULT '[]',
  specs_json TEXT NOT NULL DEFAULT '[]',
  features_json TEXT NOT NULL DEFAULT '[]',
  colors_json TEXT NOT NULL DEFAULT '[]',
  gallery_json TEXT NOT NULL DEFAULT '[]',
  spec_pdf_url TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX models_order_idx ON models (active, sort_order);

-- Textos y datos de contacto editables desde el panel.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Fotos subidas desde el panel (texto base64; el panel las achica antes de subirlas).
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

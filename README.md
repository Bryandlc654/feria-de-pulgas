# 🏺 Feria de Pulgas — Juego Multijugador en Tiempo Real

Aplicación web multijugador en tiempo real basada en las mecánicas del clásico juego de mesa **Feria de Pulgas** (similar a *Pit*). Diseñada con arquitectura de alta velocidad donde todos los comerciantes negocian e intercambian cartas simultáneamente y sin recargas de página.

---

## 🚀 Tecnologías Utilizadas

- **Frontend:** [Next.js](https://nextjs.org/) (React 18 + TypeScript), [Tailwind CSS](https://tailwindcss.com/)
- **Tiempo Real:** [Socket.io](https://socket.io/) (comunicación bidireccional de baja latencia con reconexión automática)
- **Backend:** Node.js (Servidor HTTP unificado con Socket.io y Next.js mediante `tsx`)
- **Base de Datos:** [MySQL](https://www.mysql.com/) (`mysql2/promise` para persistencia de salas, jugadores, rondas e intercambios)
- **Efectos de Sonido:** Web Audio API sintético (cero dependencias de archivos de audio externos, latencia instantánea) y `canvas-confetti`

---

## 🕹️ Mecánicas del Juego

1. **Crear o Unirse a una Sala:**
   - Un jugador crea una sala indicando su apodo, avatar e ingresa a un **Lobby** con un código único de 5 caracteres (ej. `GJW6E`).
   - Otros jugadores (de 2 a 8) se unen ingresando dicho código desde sus navegadores o dispositivos en la misma red local.
2. **Repartir Cartas:**
   - El anfitrión inicia la partida. El servidor escoge tantas antigüedades distintas como jugadores haya en la sala y genera un mazo de **9 cartas por objeto**.
   - Se baraja y se reparten en secreto **9 cartas exactas** a cada jugador.
3. **Trueque Simultáneo ("Gritos de Mercado"):**
   - Selecciona 1, 2, 3 o 4 cartas **del mismo objeto** en tu colección.
   - Pulsa **"Ofrecer al Mercado"** para poner tu oferta al aire (¡como gritar *"¡Cambio dos! ¡Cambio dos!"* en la feria!).
   - Todos los comerciantes ven en tiempo real cuántas cartas ofrece cada uno, pero **nadie puede ver qué objeto es**.
   - En cuanto veas a otro comerciante ofreciendo el mismo número de cartas que tú, aparece el botón pulsante **"🤝 ¡CAMBIAR!"**.
   - Al presionarlo, el intercambio ocurre **atómica e instantáneamente en el servidor** sin recargar la página.
4. **Victoria con Campana de Oro:**
   - En cuanto un jugador junta las **9 cartas del mismo objeto**, se desbloquea el botón dorado **"🔔 ¡TOCAR CAMPANA Y GANAR!"**.
   - El servidor valida la mano estrictamente. Al confirmarse, se detiene la ronda, se otorgan los puntos del objeto correspondiente (ej. Reloj Vintage = 100 pts) y se muestra la pantalla de victoria con la tabla de posiciones y las manos de todos para total transparencia.

---

## 🛡️ Prevención de Trampas y Reconexión

1. **Validación de Ofertas Homogéneas:** El servidor verifica que las cartas ofrecidas existan en la mano del jugador y que **todas pertenezcan a la misma antigüedad**.
2. **Trueque Atómico con Locks:** Se utilizan candados en memoria por pareja de jugadores para evitar condiciones de carrera si dos personas aceptan el intercambio en el mismo milisegundo.
3. **Validación Autorizada del Ganador:** El cliente no decide quién gana; el servidor inspecciona las 9 cartas del jugador en memoria antes de otorgar el puntaje.
4. **Reconexión Automática Transparente:**
   - Al unirse, el jugador recibe un token privado seguro guardado en `localStorage`.
   - Si la pestaña se cierra o se cae la conexión de red, al reconectarse el servidor restaura la mano privada y el estado de la partida automáticamente.
5. **Transparencia en Fin de Ronda:** Al tocar la campana, se exponen las cartas de todos los participantes para garantizar que nadie ocultó cartas ilegítimas.

---

## 📦 Estructura del Proyecto

```
pulgas/
├── server.ts                   # Servidor unificado Node.js + Socket.io + Next.js
├── src/
│   ├── components/
│   │   ├── LobbyView.tsx       # Vista de lobby previa al inicio
│   │   ├── MarketTrader.tsx    # Tarjeta de comerciante con botón de cambio instantáneo
│   │   ├── PlayingCard.tsx     # Componente visual interactivo de cartas
│   │   ├── TradingView.tsx     # Tablero principal de trueque simultáneo
│   │   ├── VictoryModal.tsx    # Modal de resultados con confetti y manos
│   │   └── WelcomeView.tsx     # Pantalla de creación y unión por código
│   ├── pages/
│   │   ├── _app.tsx
│   │   └── index.tsx           # Página principal del juego
│   ├── server/
│   │   ├── db.ts               # Conexión MySQL y creación automática de esquemas
│   │   ├── gameManager.ts      # Lógica de juego, anti-trampas, manos y trueque
│   │   ├── initDb.ts           # Script CLI para verificar MySQL
│   │   └── socketHandler.ts    # Manejadores de eventos de Socket.io
│   ├── styles/
│   │   └── globals.css         # Estilos globales y Tailwind CSS
│   ├── types/
│   │   └── game.ts             # Tipos TypeScript para cartas, jugadores y eventos
│   └── utils/
│       └── sound.ts            # Sintetizador de audio Web Audio API
├── test/
│   └── e2e-simulation.ts       # Test de simulación E2E automatizado
├── .env                        # Variables de entorno
└── package.json
```

---

## ⚙️ Cómo Correr el Proyecto Localmente

### 1. Requisitos Previos

- **Node.js** v18 o superior (`v20+` recomendado).
- **MySQL / MariaDB** (puedes usar XAMPP, Laragon, Docker o servicio MySQL nativo).

### 2. Configurar Base de Datos MySQL

Asegúrate de que tu servicio MySQL esté corriendo en el puerto `3306`.
Verifica o edita las credenciales en el archivo `.env`:

```env
PORT=3001
NODE_ENV=development

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=feria_de_pulgas
```

> **Nota:** La base de datos `feria_de_pulgas` y las tablas (`rooms`, `players`, `game_rounds`, `trades`) se crean automáticamente la primera vez que se inicia el servidor.

Puedes verificar la conexión a MySQL ejecutando:
```bash
npm run db:init
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Ejecutar en Modo Desarrollo

```bash
npm run dev
```

O en modo producción:
```bash
npm run build
npm start
```

Abre tu navegador en:
👉 **`http://localhost:3001`**

Para probar el multijugador:
- Abre una ventana normal y otra en **modo incógnito** (o en otro navegador/dispositivo conectado a tu misma red).
- En la primera ventana crea una sala.
- Copia el código de 5 letras y únete desde la segunda ventana.
- Presiona **"Abrir Feria de Pulgas"** y comienza a intercambiar cartas simultáneamente.

### 5. Ejecutar la Simulación E2E de Pruebas

Para correr el test automatizado que simula a 2 jugadores conectándose por Socket.io, repartiendo cartas, probando anti-trampas, intercambiando y reconectándose:

```bash
npm run test:e2e
```

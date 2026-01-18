# Bad Apple!! Paint Game

[Play the Game](https://bad-apple-painter.vercel.app/)

A game where you have to paint "Bad Apple!!" (or any other high-contrast video) in real-time to score points.

You will need a local copy of the video you want to paint. The website does not provide the video for you. Everything stays on your computer.

## Run Locally

1. Prerequisites:

   - [Node.js](https://nodejs.org/)
   - [pnpm](https://pnpm.io/)

2. Clone the repository:

   ```bash
   git clone https://github.com/hopperelec/bad-apple-painter
   cd bad-apple-painter
   ```
   
3. Install dependencies:

   ```bash
   pnpm i
   ```
   
4. Start the development server:

   ```bash
   pnpm dev
   ```
   
5. Navigate to `http://localhost:5173` in your web browser to play the game.

## Build for Production

To build the project for production, run:

```bash
pnpm build
```

The built files will be located in the `dist` directory.

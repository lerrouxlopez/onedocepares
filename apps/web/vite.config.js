import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
    },
    historyApiFallback: {
      rewrites: [
        { from: /^\/admin(\/|$)/, to: '/admin/index.html' },
      ],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:        resolve(__dirname, 'index.html'),
        admin:       resolve(__dirname, 'admin/index.html'),
        login:       resolve(__dirname, 'login.html'),
        page:        resolve(__dirname, 'page.html'),
        teams:       resolve(__dirname, 'teams.html'),
        team:        resolve(__dirname, 'team.html'),
        players:     resolve(__dirname, 'players.html'),
        player:      resolve(__dirname, 'player.html'),
        tournaments: resolve(__dirname, 'tournaments.html'),
        tournament:  resolve(__dirname, 'tournament.html'),
        leaderboard: resolve(__dirname, 'leaderboard.html'),
        feed:        resolve(__dirname, 'feed.html'),
      },
    },
  },
})

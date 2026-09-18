import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Bibliotecas em pacotes próprios: baixam em paralelo e ficam em cache no aparelho do cliente
        // entre uma publicação e outra (só o código do app muda; a biblioteca não).
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // jsdom + digitação simulada é lento em máquina ocupada (Windows); 5 s dava falso negativo.
    testTimeout: 15_000,
    // Testes sempre com dados de exemplo, independente das credenciais da máquina de quem roda.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_USAR_API_SIMULADA: '' },
  },
})

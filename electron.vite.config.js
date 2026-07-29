import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import commonjs from '@rollup/plugin-commonjs'

// Main/preload duoc viet bang CommonJS (require/module.exports) de cac file
// nhu src/main/db/initDb.js, src/main/db/seed.js co the chay truc tiep bang
// `node ...` (npm run db:init/db:seed) ma khong can bundler. Vi Rollup mac
// dinh chi bundle theo import/export ESM, can plugin commonjs() de no theo
// dau va gop cac require() noi bo (services/automation/queue/db) vao 1 file.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), commonjs()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.js')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), commonjs()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.js')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()]
  }
})

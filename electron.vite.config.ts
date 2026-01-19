import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// electron-vite 공식 문서 기반 구성
// - main/preload/renderer를 각각 Vite 빌드로 관리
// - 기존 코드(@ alias)를 그대로 활용
export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      outDir: 'dist/main',
      lib: {
        entry: 'src/main/index.ts',
        // package.json에 "type": "module" 이므로 main은 ESM으로 빌드
        formats: ['es'],
        fileName: () => 'index'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        }
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: 'src/preload/index.ts',
        // preload는 Electron에서 CommonJS가 안전함(ESM preload는 런타임 오류 가능)
        formats: ['cjs'],
        fileName: () => 'index'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',

    // Electron(file://)에서 절대경로(/assets/...)로 빌드되면 리소스를 못 찾아 흰 화면이 뜰 수 있다.
    // Vite base를 상대경로로 설정해 빌드 결과가 ./assets/... 형태가 되도록 한다.
    base: './',

    build: {
      // 배포 패키징(electron-builder)은 프로젝트 루트의 dist/** 만 포함하므로,
      // 반드시 루트 dist/renderer 로 출력되게 절대경로를 지정한다.
      outDir: path.resolve(__dirname, 'dist/renderer'),
      emptyOutDir: true
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  }
})

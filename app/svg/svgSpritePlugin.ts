// svgSpriteTypePlugin.ts
import type { Plugin } from 'vite'
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

interface SvgSpriteTypePluginOptions {
  // Path to your SVG sprite file (relative to project root)
  spriteFilePath: string
  // Optional output type file name (defaults to [sprite-name].types.ts)
  outputFileName?: string
}

export default function svgSpriteTypePlugin(options: SvgSpriteTypePluginOptions): Plugin {
  const { spriteFilePath } = options
  const absoluteSpriteFilePath = path.resolve(spriteFilePath)
  const outputFilePath = options.outputFileName
    || absoluteSpriteFilePath.replace(/\.svg$/, '.types.ts')

  const generateTypeDefinition = async () => {
    try {
      if (!existsSync(absoluteSpriteFilePath)) {
        console.warn(`SVG sprite file not found: ${absoluteSpriteFilePath}`)
        return
      }

      // Read the SVG sprite file
      const svgContent = await fs.readFile(absoluteSpriteFilePath, 'utf-8')

      // Use regex to extract all symbol IDs
      const symbolRegex = /<symbol[^>]*id="([^"]+)"[^>]*>/g
      const symbolIds: string[] = []

      let match = symbolRegex.exec(svgContent)
      while (match !== null) {
        symbolIds.push(match[1])
        match = symbolRegex.exec(svgContent)
      }

      // Generate the TypeScript type
      const typeContent = `// This file is auto-generated from the SVG sprite
// Do not edit manually

/**
 * All available icon names from the SVG sprite
 */
export type IconName = ${symbolIds.map(id => `'${id}'`).join(' | ')}
`

      // Write the type definition file
      await fs.writeFile(outputFilePath, typeContent)
    }
    catch (error) {
      console.error('❌ Error generating SVG sprite type definition:', error)
    }
  }

  return {
    name: 'svg-sprite-type-generator',

    // Generate during development or build start
    buildStart() {
      return generateTypeDefinition()
    },

    // Watch for changes to the SVG sprite file during development
    configureServer(server) {
      server.watcher.add(absoluteSpriteFilePath)
      server.watcher.on('change', (changedPath) => {
        if (changedPath === absoluteSpriteFilePath) {
          generateTypeDefinition()
        }
      })
      server.watcher.on('add', (changedPath) => {
        if (changedPath === absoluteSpriteFilePath) {
          generateTypeDefinition()
        }
      })
    },

    // Generate during production build
    writeBundle() {
      return generateTypeDefinition()
    },
  }
}

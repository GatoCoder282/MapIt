import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative } from 'node:path';
import ts from 'typescript';

/** Paso del generador: elimina imports sobrantes mediante semántica TS, sin relajar checks. */
export function organizeGeneratedApi(directory, configPath) {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  if (parsed.errors.length) throw new Error('Configuración TypeScript inválida para el cliente');
  const files = ts.sys.readDirectory(directory, ['.ts']);
  if (!files.length) throw new Error('No hay TypeScript generado para validar imports');
  const sources = new Map(
    files.map((file) => [
      file,
      readFileSync(file, 'utf8').replace(/^[ \t]*\/\/ @ts-ignore[^\r\n]*\r?\n/gm, ''),
    ]),
  );
  const host = {
    ...ts.sys,
    getCompilationSettings: () => parsed.options,
    getScriptFileNames: () => files,
    getScriptVersion: () => '1',
    getScriptSnapshot: (file) => {
      const text = sources.get(file) ?? ts.sys.readFile(file);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => dirname(configPath),
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  };
  const service = ts.createLanguageService(host);
  const results = new Map(sources);
  try {
    for (const file of files) {
      for (const change of service.organizeImports({ type: 'file', fileName: file }, {}, {})) {
        const inside = relative(directory, change.fileName);
        if (inside.startsWith('..') || isAbsolute(inside))
          throw new Error('Edición fuera del cliente generado');
        let text = sources.get(change.fileName);
        if (text === undefined) throw new Error('Archivo ajeno a la generación');
        for (const edit of [...change.textChanges].sort((a, b) => b.span.start - a.span.start)) {
          text =
            text.slice(0, edit.span.start) +
            edit.newText +
            text.slice(edit.span.start + edit.span.length);
        }
        results.set(change.fileName, text);
      }
    }
  } finally {
    service.dispose();
  }
  for (const [file, text] of results) {
    if (readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
  }
  return files.length;
}

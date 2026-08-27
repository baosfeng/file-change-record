    // ── icons (inline, stroke=currentColor, matching better-sidebar) ──────
    const ICON_STROKE = 1.8
    const iconSvg = (children, size) =>
      createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: ICON_STROKE, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, children.map((child, i) => (child === null || child === undefined || typeof child === 'boolean')
        ? child
        : createElement(child.type, { key: i, ...child.props })))

    const icon = {
      clock: (size = 16) => iconSvg([
        createElement('circle', { cx: 12, cy: 12, r: 9 }),
        createElement('path', { d: 'M12 7v5l3 2' }),
      ], size),
      refresh: (size = 16) => iconSvg([
        createElement('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        createElement('polyline', { points: '21 3 21 9 15 9' }),
      ], size),
      trash: (size = 16) => iconSvg([
        createElement('path', { d: 'M3 6h18' }),
        createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
        createElement('path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
      ], size),
      chevronRight: (size = 14) => iconSvg([
        createElement('polyline', { points: '9 6 15 12 9 18' }),
      ], size),
      chevronDown: (size = 14) => iconSvg([
        createElement('polyline', { points: '6 9 12 15 18 9' }),
      ], size),
      file: (size = 16) => iconSvg([
        createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        createElement('path', { d: 'M14 2v6h6' }),
      ], size),
      folder: (size = 16) => iconSvg([
        createElement('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
      ], size),
      external: (size = 15) => iconSvg([
        createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
        createElement('polyline', { points: '15 3 21 3 21 9' }),
        createElement('line', { x1: 10, y1: 14, x2: 21, y2: 3 }),
      ], size),
      close: (size = 15) => iconSvg([
        createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
        createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
      ], size),
    }

    // Common-language / file-type badges (issue #24): brand fill + contrast
    // ink, reading on both light and dark themes. Unmapped extensions keep the
    // neutral currentColor file icon above. [bg, fg ink, short mark]
    const FILE_BADGES = {
      // JavaScript / TypeScript
      js: ['#F7DF1E', '#323330', 'JS'], mjs: ['#F7DF1E', '#323330', 'JS'], cjs: ['#F7DF1E', '#323330', 'JS'],
      ts: ['#3178C6', '#ffffff', 'TS'], mts: ['#3178C6', '#ffffff', 'TS'], cts: ['#3178C6', '#ffffff', 'TS'],
      tsx: ['#3178C6', '#ffffff', 'TSX'], jsx: ['#3178C6', '#ffffff', 'JSX'],
      // 后端语言
      java: ['#007396', '#ffffff', 'JAVA'],
      c: ['#A8B9CC', '#111111', 'C'],
      cpp: ['#00599C', '#ffffff', 'C++'], cxx: ['#00599C', '#ffffff', 'C++'], cc: ['#00599C', '#ffffff', 'C++'], hpp: ['#00599C', '#ffffff', 'C++'],
      h: ['#A8B9CC', '#111111', 'H'], hh: ['#A8B9CC', '#111111', 'H'],
      cs: ['#68217A', '#ffffff', 'C#'], csharp: ['#68217A', '#ffffff', 'C#'],
      go: ['#00ADD8', '#ffffff', 'GO'],
      rs: ['#CE422B', '#ffffff', 'RS'],
      rb: ['#B51624', '#ffffff', 'RB'],
      php: ['#777BB4', '#ffffff', 'PHP'],
      py: ['#3776AB', '#ffffff', 'PY'],
      swift: ['#F05138', '#ffffff', 'SWIFT'],
      kt: ['#7F52FF', '#ffffff', 'KT'], kotlin: ['#7F52FF', '#ffffff', 'KT'],
      dart: ['#0175C2', '#ffffff', 'DART'],
      scala: ['#DC322F', '#ffffff', 'SCALA'],
      lua: ['#2C2C7C', '#ffffff', 'LUA'],
      pl: ['#0298C3', '#ffffff', 'PERL'],
      r: ['#336DC3', '#ffffff', 'R'],
      m: ['#C1272D', '#ffffff', 'MAT'], mm: ['#C1272D', '#ffffff', 'MAT'],
      // Web / 前端
      html: ['#E34F26', '#ffffff', '</>'], htm: ['#E34F26', '#ffffff', '</>'],
      css: ['#663399', '#ffffff', 'CSS'],
      scss: ['#CD6799', '#ffffff', 'SCSS'], sass: ['#CD6799', '#ffffff', 'SCSS'],
      vue: ['#42B883', '#ffffff', 'VUE'],
      svelte: ['#FF3E00', '#ffffff', 'SVELTE'],
      // 数据 / 结构化
      json: ['#F7DF1E', '#323330', '{}'],
      sql: ['#00758F', '#ffffff', 'SQL'],
      csv: ['#2E7D32', '#ffffff', 'CSV'],
      db: ['#0F62FE', '#ffffff', 'DB'], sqlite: ['#0F62FE', '#ffffff', 'DB'], sqlite3: ['#0F62FE', '#ffffff', 'DB'],
      xml: ['#FF6F00', '#ffffff', 'XML'],
      svg: ['#FF6F00', '#ffffff', 'SVG'],
      // 文档
      md: ['#42A5F5', '#ffffff', 'M↓'], markdown: ['#42A5F5', '#ffffff', 'M↓'],
      txt: ['#90A4AE', '#ffffff', 'TXT'], text: ['#90A4AE', '#ffffff', 'TXT'], log: ['#90A4AE', '#ffffff', 'TXT'],
      pdf: ['#E5202B', '#ffffff', 'PDF'],
      doc: ['#2B579A', '#ffffff', 'DOC'], docx: ['#2B579A', '#ffffff', 'DOC'],
      xls: ['#217346', '#ffffff', 'XLS'], xlsx: ['#217346', '#ffffff', 'XLS'],
      ppt: ['#D24726', '#ffffff', 'PPT'], pptx: ['#D24726', '#ffffff', 'PPT'],
      // 配置 / 构建
      yml: ['#CB171E', '#ffffff', 'YML'], yaml: ['#CB171E', '#ffffff', 'YML'],
      toml: ['#8D6E63', '#ffffff', 'TOML'],
      ini: ['#546E7A', '#ffffff', 'CFG'], cfg: ['#546E7A', '#ffffff', 'CFG'], config: ['#546E7A', '#ffffff', 'CFG'],
      env: ['#F9A825', '#323330', 'ENV'],
      properties: ['#7B1FA2', '#ffffff', 'PROP'],
      lock: ['#37474F', '#ffffff', 'LOCK'],
      dockerfile: ['#2496ED', '#ffffff', 'DOCK'], docker: ['#2496ED', '#ffffff', 'DOCK'],
      makefile: ['#607D8B', '#ffffff', 'MAKE'],
      gradle: ['#02303A', '#ffffff', 'GRADLE'],
      cmake: ['#265774', '#ffffff', 'CMAKE'],
      ipynb: ['#F37726', '#ffffff', 'JNB'],
      // 脚本 / Shell
      sh: ['#89E051', '#111111', '>_'], bash: ['#89E051', '#111111', '>_'], zsh: ['#89E051', '#111111', '>_'],
      ps1: ['#012456', '#ffffff', 'PS1'],
      bat: ['#546E7A', '#ffffff', 'CMD'], cmd: ['#546E7A', '#ffffff', 'CMD'],
      // 打包 / 二进制
      zip: ['#FFA726', '#323330', 'ZIP'], tar: ['#FFA726', '#323330', 'ZIP'], gz: ['#FFA726', '#323330', 'ZIP'],
      '7z': ['#FFA726', '#323330', 'ZIP'], rar: ['#FFA726', '#323330', 'ZIP'],
      exe: ['#0078D4', '#ffffff', 'EXE'], msi: ['#0078D4', '#ffffff', 'EXE'],
      wasm: ['#654FF0', '#ffffff', 'WASM'],
      // 图片 / 媒体
      png: ['#8E44AD', '#ffffff', 'IMG'], jpg: ['#8E44AD', '#ffffff', 'IMG'], jpeg: ['#8E44AD', '#ffffff', 'IMG'],
      gif: ['#8E44AD', '#ffffff', 'IMG'], webp: ['#8E44AD', '#ffffff', 'IMG'], ico: ['#8E44AD', '#ffffff', 'IMG'], bmp: ['#8E44AD', '#ffffff', 'IMG'],
      // 版本控制
      gitignore: ['#F05032', '#ffffff', 'GIT'], gitattributes: ['#F05032', '#ffffff', 'GIT'],
    }

    /** One self-colored badge svg: rounded brand rect + short contrast mark.
     *  Mark font scales by length so 5-6 char marks (JAVA/SCALA/SWIFT) stay
     *  inside the 24×24 viewBox. */
    const badgeIcon = ([bg, fg, mark], size) =>
      createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true',
      },
      createElement('rect', { x: 1, y: 1, width: 22, height: 22, rx: 5, fill: bg }),
      createElement('text', {
        x: 12, y: 16, textAnchor: 'middle', fontSize: mark.length <= 2 ? 9 : mark.length <= 4 ? 7 : 5.5,
        fontWeight: 700, fill: fg,
      }, mark))

    /** File-type icon dispatcher: branded badge for known extensions, the
     *  neutral file icon for everything else (case-insensitive, tolerates a
     *  leading dot like ".md"). */
    const fileIconByExt = (ext, size = 14) => {
      const spec = FILE_BADGES[String(ext ?? '').toLowerCase().replace(/^\./, '')]
      return spec === undefined ? icon.file(size) : badgeIcon(spec, size)
    }

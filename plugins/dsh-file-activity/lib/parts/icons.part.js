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

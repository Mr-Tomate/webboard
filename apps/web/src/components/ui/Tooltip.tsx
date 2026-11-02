import React, { useEffect, useRef } from 'react';
import tippy, { type Instance, type Placement } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

interface TooltipProps {
  content: string;
  children: React.ReactElement<any>;
  placement?: Placement;
  delay?: [number, number];
  shortcut?: string;
}

/**
 * Componente Tooltip baseado em Tippy.js integrado ao estilo escuro do Webboard.
 * Fornece feedback rico e autoexplicativo ao passar o mouse sobre botões compactos.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'bottom',
  delay = [150, 0],
  shortcut
}) => {
  const targetRef = useRef<HTMLElement | null>(null);
  const instanceRef = useRef<Instance | null>(null);

  useEffect(() => {
    if (!targetRef.current) return;

    const formattedContent = shortcut
      ? `<div class="flex items-center gap-1.5 font-medium text-xs"><span>${content}</span><kbd class="px-1 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-300 rounded border border-zinc-700">${shortcut}</kbd></div>`
      : `<span class="text-xs font-medium">${content}</span>`;

    instanceRef.current = tippy(targetRef.current, {
      content: formattedContent,
      allowHTML: true,
      placement,
      delay,
      arrow: true,
      animation: 'fade',
      theme: 'webboard'
    });

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [content, placement, delay, shortcut]);

  return React.cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      targetRef.current = node;
      const { ref } = children as any;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }
  });
};

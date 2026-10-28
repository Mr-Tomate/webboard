import { useState, useCallback, useEffect } from 'react';
import type { Position2D } from '@webboard/contracts';
import {
  clampZoom,
  calculateZoomAtPointer,
  screenToWorld,
  worldToScreen
} from '../utils/geometry.js';
import type { ViewportState } from '../types/canvas.js';

export function useViewport(initialScale = 1.0, initialOffset: Position2D = { x: 0, y: 0 }) {
  const [viewport, setViewport] = useState<ViewportState>({
    scale: initialScale,
    offset: initialOffset
  });

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const panBy = useCallback((delta: Position2D) => {
    setViewport((prev) => ({
      ...prev,
      offset: {
        x: prev.offset.x + delta.x,
        y: prev.offset.y + delta.y
      }
    }));
  }, []);

  const setOffset = useCallback((offset: Position2D) => {
    setViewport((prev) => ({
      ...prev,
      offset
    }));
  }, []);

  const zoomTo = useCallback((newScale: number, pointerScreenPos?: Position2D) => {
    setViewport((prev) => {
      const clampedScale = clampZoom(newScale);
      if (clampedScale === prev.scale) return prev;

      const pointer = pointerScreenPos ?? {
        x: dimensions.width / 2,
        y: dimensions.height / 2
      };

      const newOffset = calculateZoomAtPointer(
        pointer,
        prev.offset,
        prev.scale,
        clampedScale
      );

      return {
        scale: clampedScale,
        offset: newOffset
      };
    });
  }, [dimensions]);

  const zoomIn = useCallback(() => {
    zoomTo(viewport.scale * 1.25);
  }, [viewport.scale, zoomTo]);

  const zoomOut = useCallback(() => {
    zoomTo(viewport.scale / 1.25);
  }, [viewport.scale, zoomTo]);

  const resetView = useCallback(() => {
    setViewport({
      scale: 1.0,
      offset: { x: 0, y: 0 }
    });
  }, []);

  const toWorld = useCallback((screenPos: Position2D) => {
    return screenToWorld(screenPos, viewport.offset, viewport.scale);
  }, [viewport]);

  const toScreen = useCallback((worldPos: Position2D) => {
    return worldToScreen(worldPos, viewport.offset, viewport.scale);
  }, [viewport]);

  return {
    viewport,
    dimensions,
    panBy,
    setOffset,
    zoomTo,
    zoomIn,
    zoomOut,
    resetView,
    toWorld,
    toScreen
  };
}

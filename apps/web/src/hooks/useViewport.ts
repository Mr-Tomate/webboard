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
      offset: { x: 50, y: 50 }
    });
  }, []);

  const fitToComponents = useCallback(
    (componentPositions: Position2D[], padding = 120) => {
      if (componentPositions.length === 0) {
        setViewport({ scale: 1.0, offset: { x: 50, y: 50 } });
        return;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const p of componentPositions) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + 140);
        maxY = Math.max(maxY, p.y + 140);
      }

      const contentWidth = Math.max(maxX - minX, 100);
      const contentHeight = Math.max(maxY - minY, 100);

      const availableWidth = dimensions.width - padding * 2;
      const availableHeight = dimensions.height - padding * 2;

      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      const rawScale = Math.min(scaleX, scaleY, 1.1);
      const scale = clampZoom(rawScale);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const offset = {
        x: dimensions.width / 2 - centerX * scale,
        y: dimensions.height / 2 - centerY * scale
      };

      setViewport({ scale, offset });
    },
    [dimensions]
  );

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
    fitToComponents,
    toWorld,
    toScreen
  };
}

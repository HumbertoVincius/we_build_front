"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  isLoading?: boolean;
}

export function RefreshButton({ onRefresh, isLoading = false }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const containerElement = document.getElementById("refresh-button-container");
    setContainer(containerElement);
  }, []);

  const handleClick = async () => {
    if (isRefreshing || isLoading) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      // Small delay to show the animation
      setTimeout(() => {
        setIsRefreshing(false);
      }, 300);
    }
  };

  const isActive = isRefreshing || isLoading;

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={isActive}
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300",
        "bg-slate-800/60 backdrop-blur-sm border-slate-600 text-slate-300",
        "hover:bg-slate-700 hover:border-slate-500 hover:text-white",
        "active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-60",
        isActive && "animate-spin"
      )}
      title="Atualizar dados"
      aria-label="Atualizar dados"
    >
      <svg
        className={clsx("h-4 w-4", isActive && "animate-spin")}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </button>
  );

  if (!container) {
    return null;
  }

  return createPortal(button, container);
}


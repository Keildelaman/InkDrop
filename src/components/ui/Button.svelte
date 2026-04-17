<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    class?: string;
    title?: string;
  }

  let {
    variant = 'secondary',
    size = 'md',
    disabled = false,
    onclick,
    children,
    class: className = '',
    title,
  }: Props = $props();

  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-accent text-white hover:bg-accent-hover active:scale-[0.97] shadow-sm',
    secondary: 'bg-surface-alt text-text hover:bg-border active:scale-[0.97] border border-border',
    danger: 'bg-danger text-white hover:bg-danger-hover active:scale-[0.97]',
    ghost: 'text-text-muted hover:text-text hover:bg-surface-alt',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
</script>

<button
  class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]} {className}"
  {disabled}
  {onclick}
  {title}
>
  {@render children()}
</button>

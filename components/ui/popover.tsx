"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Provides the popover root element that manages popover state and context.
 *
 * @returns A React element representing the popover root
 */
function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

/**
 * Renders a popover trigger element and forwards all received props to the underlying element.
 *
 * The rendered element includes a `data-slot="popover-trigger"` attribute.
 *
 * @returns A React element that serves as the popover trigger.
 */
function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

/**
 * Renders popover content inside a portal with consistent styling and positioning.
 *
 * @param className - Optional additional CSS class names merged with the component's base styles.
 * @param align - Alignment of the popover relative to the trigger (e.g., `"center"`, `"start"`, `"end"`). Default: `"center"`.
 * @param sideOffset - Distance in pixels between the popover and its trigger. Default: `4`.
 * @returns The rendered Popover content element
 */
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

/**
 * Renders an anchor element used for popover positioning and forwards received props.
 *
 * @param props - Props to pass through to the underlying Popover Anchor element
 * @returns The rendered popover anchor element
 */
function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

/**
 * Layout wrapper for a popover header that applies consistent spacing and small text sizing.
 *
 * @param className - Additional CSS class names to merge with the base header styles
 */
function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  )
}

/**
 * Renders the popover title element with heading styling.
 *
 * Merges `className` with the component's default heading classes and forwards all other props to the underlying element.
 *
 * @param className - Additional CSS class names to merge with the default heading styles
 * @param props - Other native element props forwarded to the rendered element
 * @returns The popover title element
 */
function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("font-heading font-medium", className)}
      {...props}
    />
  )
}

/**
 * Renders the popover description text with the component's base styling.
 *
 * @param className - Additional CSS class names to merge with the default description styles
 * @param props - Additional props forwarded to the underlying `<p>` element
 * @returns A `<p>` element with the popover description styling and forwarded props
 */
function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}

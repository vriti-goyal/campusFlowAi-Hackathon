# CampusFlow AI - Frontend UI Guidelines

To maintain a consistent, premium, and polished user interface across the entire application, all new code pushed to or pulled from the `main` branch **MUST** adhere to the following UI guidelines.

## 1. Core Design System

### Typography
- **Font Family:** `Poppins` (imported via Google Fonts).
- Ensure readability by using standard Tailwind text sizing (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.).
- Use `font-bold` for important headings and `font-medium` or `font-semibold` for secondary labels.

### Color Palette (CSS Variables)
Always use the CSS variables defined in `src/index.css` rather than hardcoding hex values. This ensures global consistency.
- **Background:** `bg-[var(--bg)]`
- **Cards/Surfaces:** `bg-[var(--card)]` or `bg-[var(--card-elevated)]`
- **Primary Text:** `text-[var(--text-primary)]`
- **Secondary Text:** `text-[var(--text-secondary)]`
- **Muted/Placeholder Text:** `text-[var(--text-muted)]`
- **Primary Brand (Purple):** `text-[#6A68DF]`, `bg-[#6A68DF]`, `border-[#6A68DF]`
- **Accent Brand (Peach):** `text-[#EFB995]`, `bg-[#EFB995]`, `border-[#EFB995]`

*Note: Dark mode has been officially removed from the application. **DO NOT** use `dark:` prefixed Tailwind classes.*

---

## 2. Shared Components (The "CF" Library)

Do **NOT** build UI elements (buttons, cards, badges) from scratch using raw HTML tags and raw Tailwind classes if a `CF` component exists. Always import from `src/components/ui/`.

### `CFCard`
Use for all main content containers.
- Built-in `rounded-2xl` (or `rounded-xl`), borders, and soft shadows.
- Supports a `gradient` boolean prop for special highlight cards.
- **Usage:** `<CFCard className="p-6"> ... </CFCard>`

### `CFButton`
Use for all clickable actions.
- Built-in pill shape (`rounded-full`), hover states, disabled states, and loading spinners.
- **Variants:** `primary`, `secondary`, `ghost`, `danger`.
- **Sizes:** `sm`, `md`, `lg`.
- **Usage:** `<CFButton variant="primary" icon={Plus} loading={isLoading}>Submit</CFButton>`

### `CFBadge`
Use for statuses, tags, categories, and labels.
- **Variants:** `default`, `high`, `medium`, `low`, `success`, `danger`, `warning`.
- **Usage:** `<CFBadge variant="success">Completed</CFBadge>`

### `CFInput`
Use for text fields, textareas, and selects.
- Standardized `rounded-2xl` or `rounded-full` shapes with primary color focus rings.
- **Usage:** `<CFInput icon={Search} placeholder="Search..." />`

### `CFSkeleton` & `CFEmptyState`
- Use `<CFSkeleton />` for all loading states instead of plain spinners.
- Use `<CFEmptyState icon={Icon} title="..." description="..." />` whenever a list or table has zero items.

---

## 3. UI/UX Rules & Best Practices

1. **Rounded Geometries:** Everything should feel soft and modern. Avoid sharp corners (`rounded-none` or `rounded-sm`). Default to `rounded-xl`, `rounded-2xl`, or `rounded-full`.
2. **Spacing & Layouts:** Use standard Tailwind spacing gaps (`gap-4`, `gap-6`) and paddings (`p-6`, `p-8`). Give elements breathing room.
3. **Icons:** Use `lucide-react` for all icons. Ensure icons have consistent sizing (usually `size={16}`, `18`, or `20`) and are vertically aligned with text.
4. **Borders & Shadows:** Use subtle borders (`border border-[var(--border)]`) and soft shadows (`shadow-sm`, `shadow-md`) to define hierarchy. Avoid harsh, dark drop-shadows.
5. **Interactive Feedback:** All interactive elements must have hover and active states (e.g., `hover:scale-105`, `hover:bg-[var(--border)]`, `transition-all`).

By strictly following these rules, we ensure that CampusFlow AI remains a beautiful, state-of-the-art platform regardless of who contributes to the codebase!

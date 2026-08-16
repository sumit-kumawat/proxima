import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-8 flex flex-col items-center gap-2">
        <BrandLogo showText />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <footer className="mt-8 text-center text-xs text-muted-foreground">
        <a
          href="https://github.com/conzex/proxima"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Conzex Global Private Limited - an Opensource project.
        </a>
      </footer>
    </div>
  );
}

import { Input } from "@/components/ui/input";

export function MoneyInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} type="number" inputMode="numeric" className={`tabular ${props.className ?? ""}`} />;
}

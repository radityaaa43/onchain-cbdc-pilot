import { AssetWizard } from "@/components/app/asset-wizard";

export default function NewAssetPage() {
  return (
    <section>
      <h1 className="font-mono text-lg mb-4">Create Asset</h1>
      <AssetWizard />
    </section>
  );
}

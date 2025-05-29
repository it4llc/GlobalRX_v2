"use client";

import { useTranslation } from "@/contexts/TranslationContext";
import { AlertBox } from "@/components/ui/alert-box";

export default function WorkflowSectionsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {t("module.candidateWorkflow.tabs.sections")}
        </h1>
      </div>

      <AlertBox
        type="info"
        title={t("common.comingSoon")}
        description={t("module.candidateWorkflow.sectionsMgmtComingSoon")}
      />
    </div>
  );
}
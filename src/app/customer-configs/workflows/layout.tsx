"use client";

import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/contexts/TranslationContext";
import { ContentSection } from "@/components/layout/ContentSection";

export default function WorkflowsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  // Determine which tab is active based on the URL
  const getTabValue = () => {
    if (pathname.includes("/customer-configs/workflows/templates")) {
      return "templates";
    } else if (pathname.includes("/customer-configs/workflows/sections")) {
      return "sections";
    } else if (pathname.includes("/customer-configs/workflows/documents")) {
      return "documents";
    } else {
      return "workflows";
    }
  };

  return (
    <ContentSection>
      <Tabs
        defaultValue={getTabValue()}
        className="w-full"
        onValueChange={(value) => {
          router.push(`/customer-configs/workflows/${value === "workflows" ? "" : value}`);
        }}
      >
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="workflows">
            {t("module.candidateWorkflow.tabs.workflows")}
          </TabsTrigger>
          <TabsTrigger value="sections">
            {t("module.candidateWorkflow.tabs.sections")}
          </TabsTrigger>
          <TabsTrigger value="documents">
            {t("module.candidateWorkflow.tabs.documents")}
          </TabsTrigger>
          <TabsTrigger value="templates">
            {t("module.candidateWorkflow.tabs.templates")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={getTabValue()} className="w-full">
          {children}
        </TabsContent>
      </Tabs>
    </ContentSection>
  );
}
"use client";

import { use } from "react";
import { OperatorForm } from "../../../operator-form";

export default function EditOperatorPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  return <OperatorForm userId={userId} />;
}

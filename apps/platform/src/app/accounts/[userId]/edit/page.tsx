"use client";

import { use } from "react";
import { AccountForm } from "../../../account-form";

export default function EditAccountPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  return <AccountForm userId={userId} />;
}

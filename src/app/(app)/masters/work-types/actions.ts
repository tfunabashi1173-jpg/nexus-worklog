"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

export async function createWorkType(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!name) {
    redirect(
      `/masters/work-types?error=${encodeURIComponent(
        "作業内容を入力してください。"
      )}`
    );
  }
  if (!categoryId) {
    redirect(
      `/masters/work-types?error=${encodeURIComponent(
        "カテゴリを選択してください。"
      )}`
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("work_types")
    .select("id, id_deleted")
    .eq("name", name)
    .eq("category_id", categoryId)
    .limit(1)
    .maybeSingle();
  if (existingError) {
    console.error("Lookup work type error", existingError);
    redirect(
      `/masters/work-types?error=${encodeURIComponent(existingError.message)}`
    );
  }
  if (existing) {
    if (existing.id_deleted) {
      const { error: restoreError } = await supabase
        .from("work_types")
        .update({ id_deleted: false, deleted_at: null })
        .eq("id", existing.id);
      revalidatePath("/masters/work-types");
      if (restoreError) {
        console.error("Restore work type error", restoreError);
        redirect(
          `/masters/work-types?error=${encodeURIComponent(restoreError.message)}`
        );
      }
      redirect("/masters/work-types?success=restored");
    }
    redirect(
      `/masters/work-types?error=${encodeURIComponent(
        "同じ作業内容が既に登録されています。"
      )}`
    );
  }

  const { error } = await supabase.from("work_types").insert({
    name,
    category_id: categoryId,
    id_deleted: false,
  });
  if (error) {
    console.error("Failed to create work type", error);
    redirect(
      `/masters/work-types?error=${encodeURIComponent(
        "作業内容の登録に失敗しました。"
      )}`
    );
  }

  revalidatePath("/masters/work-types");
  redirect("/masters/work-types?success=created");
}

export async function updateWorkType(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const workTypeId = String(formData.get("workTypeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!workTypeId || !name) {
    return;
  }

  const supabase = createSupabaseServerClient();
  await supabase
    .from("work_types")
    .update({ name, category_id: categoryId || null })
    .eq("id", workTypeId);

  revalidatePath("/masters/work-types");
}

export async function deleteWorkType(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const workTypeId = String(formData.get("workTypeId") ?? "");
  if (!workTypeId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  await supabase
    .from("work_types")
    .update({ id_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", workTypeId);

  revalidatePath("/masters/work-types");
}

export async function createWorkCategory(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("work_categories")
    .select("id, id_deleted")
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (existingError) {
    console.error("Lookup work category error", existingError);
    redirect(
      `/masters/work-types?error=${encodeURIComponent(existingError.message)}`
    );
  }
  if (existing) {
    if (existing.id_deleted) {
      const { error: restoreError } = await supabase
        .from("work_categories")
        .update({ id_deleted: false, deleted_at: null })
        .eq("id", existing.id);
      revalidatePath("/masters/work-types");
      if (restoreError) {
        console.error("Restore work category error", restoreError);
        redirect(
          `/masters/work-types?error=${encodeURIComponent(restoreError.message)}`
        );
      }
      redirect("/masters/work-types?success=categoryRestored");
    }
    redirect(
      `/masters/work-types?error=${encodeURIComponent(
        "同じカテゴリが既に登録されています。"
      )}`
    );
  }

  const { error } = await supabase
    .from("work_categories")
    .insert({ name, id_deleted: false });
  if (error) {
    console.error("Create work category error", error);
    redirect(
      `/masters/work-types?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/masters/work-types");
  redirect("/masters/work-types?success=categoryCreated");
}

export async function importWorkTypesCsv(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    redirect(
      `/masters/work-types?error=${encodeURIComponent(
        "CSVファイルを選択してください。"
      )}`
    );
  }

  const content = await file.text();
  const normalized = content.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    redirect(
      `/masters/work-types?error=${encodeURIComponent(
        "CSVに登録対象がありません。"
      )}`
    );
  }

  const supabase = createSupabaseServerClient();
  let imported = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const [categoryRaw, nameRaw] = lines[i].split(",").map((value) => value?.trim());
    const categoryName = categoryRaw ?? "";
    const workTypeName = nameRaw ?? "";
    if (!categoryName || !workTypeName) {
      continue;
    }

    const { data: category, error: categoryError } = await supabase
      .from("work_categories")
      .select("id, id_deleted")
      .eq("name", categoryName)
      .limit(1)
      .maybeSingle();
    if (categoryError) {
      console.error("Lookup work category error", categoryError);
      redirect(
        `/masters/work-types?error=${encodeURIComponent(categoryError.message)}`
      );
    }

    let categoryId = category?.id ?? null;
    if (!categoryId) {
      const { data: createdCategory, error: createCategoryError } = await supabase
        .from("work_categories")
        .insert({ name: categoryName, id_deleted: false })
        .select("id")
        .single();
      if (createCategoryError) {
        console.error("Create work category error", createCategoryError);
        redirect(
          `/masters/work-types?error=${encodeURIComponent(
            createCategoryError.message
          )}`
        );
      }
      categoryId = createdCategory?.id ?? null;
    } else if (category?.id_deleted) {
      const { error: restoreCategoryError } = await supabase
        .from("work_categories")
        .update({ id_deleted: false, deleted_at: null })
        .eq("id", categoryId);
      if (restoreCategoryError) {
        console.error("Restore work category error", restoreCategoryError);
        redirect(
          `/masters/work-types?error=${encodeURIComponent(
            restoreCategoryError.message
          )}`
        );
      }
    }

    if (!categoryId) {
      continue;
    }

    const { data: existingType, error: typeLookupError } = await supabase
      .from("work_types")
      .select("id, id_deleted")
      .eq("name", workTypeName)
      .eq("category_id", categoryId)
      .limit(1)
      .maybeSingle();
    if (typeLookupError) {
      console.error("Lookup work type error", typeLookupError);
      redirect(
        `/masters/work-types?error=${encodeURIComponent(typeLookupError.message)}`
      );
    }

    if (existingType?.id) {
      if (existingType.id_deleted) {
        const { error: restoreTypeError } = await supabase
          .from("work_types")
          .update({ id_deleted: false, deleted_at: null })
          .eq("id", existingType.id);
        if (restoreTypeError) {
          console.error("Restore work type error", restoreTypeError);
          redirect(
            `/masters/work-types?error=${encodeURIComponent(
              restoreTypeError.message
            )}`
          );
        }
        imported += 1;
      }
      continue;
    }

    const { error: insertTypeError } = await supabase.from("work_types").insert({
      name: workTypeName,
      category_id: categoryId,
      id_deleted: false,
    });
    if (insertTypeError) {
      console.error("Create work type error", insertTypeError);
      redirect(
        `/masters/work-types?error=${encodeURIComponent(insertTypeError.message)}`
      );
    }
    imported += 1;
  }

  revalidatePath("/masters/work-types");
  redirect(
    `/masters/work-types?success=${encodeURIComponent(
      `imported:${imported}`
    )}`
  );
}

export async function updateWorkCategory(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!categoryId || !name) {
    return;
  }

  const supabase = createSupabaseServerClient();
  await supabase
    .from("work_categories")
    .update({ name })
    .eq("id", categoryId);

  revalidatePath("/masters/work-types");
}

export async function deleteWorkCategory(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  await supabase
    .from("work_categories")
    .update({ id_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", categoryId);

  revalidatePath("/masters/work-types");
}

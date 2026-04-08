/**
 * Farm Service
 * Supabase data layer for farm records, activities, notifications, and AI requests.
 */

import { supabase } from "./supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FarmRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  recordType: string;
  cropType?: string;
  areaPlanted?: number;
  areaUnit: string;
  growthStage?: string;
  sowingDate?: string;
  expectedHarvestDate?: string;
  actualHarvestDate?: string;
  expectedYield?: number;
  actualYield?: number;
  yieldUnit: string;
  healthStatus: string;
  pestDiseaseFlags: string[];
  aiDiagnosisStatus: string;
  mediaUrls: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbFarmActivity {
  id: string;
  userId: string;
  farmRecordId?: string;
  activityType: string;
  title: string;
  notes?: string;
  startTime: string;
  endTime?: string;
  isCompleted: boolean;
  isRecurring: boolean;
  alarmAt?: string;
  inputsUsed?: string;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FarmNotification {
  id: string;
  notificationType: string;
  title: string;
  message: string;
  relatedRecordId?: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRecord(row: any): FarmRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? "",
    recordType: row.record_type ?? "crop",
    cropType: row.crop_type ?? undefined,
    areaPlanted: row.area_planted ?? undefined,
    areaUnit: row.area_unit ?? "acres",
    growthStage: row.growth_stage ?? undefined,
    sowingDate: row.sowing_date ?? undefined,
    expectedHarvestDate: row.expected_harvest_date ?? undefined,
    actualHarvestDate: row.actual_harvest_date ?? undefined,
    expectedYield: row.expected_yield ?? undefined,
    actualYield: row.actual_yield ?? undefined,
    yieldUnit: row.yield_unit ?? "kg",
    healthStatus: row.health_status ?? "healthy",
    pestDiseaseFlags: row.pest_disease_flags ?? [],
    aiDiagnosisStatus: row.ai_diagnosis_status ?? "none",
    mediaUrls: row.media_urls ?? [],
    status: row.status ?? "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeActivity(row: any): DbFarmActivity {
  return {
    id: row.id,
    userId: row.user_id,
    farmRecordId: row.farm_record_id ?? undefined,
    activityType: row.activity_type,
    title: row.title,
    notes: row.notes ?? undefined,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    isCompleted: row.is_completed ?? false,
    isRecurring: row.is_recurring ?? false,
    alarmAt: row.alarm_at ?? undefined,
    inputsUsed: row.inputs_used ?? undefined,
    estimatedCost: row.estimated_cost ?? undefined,
    actualCost: row.actual_cost ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Farm Records ─────────────────────────────────────────────────────────────

export async function fetchFarmRecords(): Promise<FarmRecord[]> {
  const { data, error } = await supabase
    .from("farm_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeRecord);
}

export async function createFarmRecord(data: {
  name: string;
  description?: string;
  recordType: string;
  cropType?: string;
  areaPlanted?: number;
  areaUnit?: string;
  growthStage?: string;
  sowingDate?: string;
  expectedHarvestDate?: string;
  expectedYield?: number;
  yieldUnit?: string;
}): Promise<FarmRecord> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: row, error } = await supabase
    .from("farm_records")
    .insert({
      user_id: userId,
      name: data.name,
      description: data.description ?? "",
      record_type: data.recordType,
      crop_type: data.cropType ?? null,
      area_planted: data.areaPlanted ?? null,
      area_unit: data.areaUnit ?? "acres",
      growth_stage: data.growthStage ?? null,
      sowing_date: data.sowingDate ?? null,
      expected_harvest_date: data.expectedHarvestDate ?? null,
      expected_yield: data.expectedYield ?? null,
      yield_unit: data.yieldUnit ?? "kg",
    })
    .select()
    .single();

  if (error) throw error;
  return normalizeRecord(row);
}

export async function updateFarmRecord(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    growthStage: string;
    healthStatus: string;
    pestDiseaseFlags: string[];
    aiDiagnosisStatus: string;
    mediaUrls: string[];
    actualYield: number;
    actualHarvestDate: string;
    status: string;
  }>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u: any = {};
  if (data.name !== undefined) u.name = data.name;
  if (data.description !== undefined) u.description = data.description;
  if (data.growthStage !== undefined) u.growth_stage = data.growthStage;
  if (data.healthStatus !== undefined) u.health_status = data.healthStatus;
  if (data.pestDiseaseFlags !== undefined) u.pest_disease_flags = data.pestDiseaseFlags;
  if (data.aiDiagnosisStatus !== undefined) u.ai_diagnosis_status = data.aiDiagnosisStatus;
  if (data.mediaUrls !== undefined) u.media_urls = data.mediaUrls;
  if (data.actualYield !== undefined) u.actual_yield = data.actualYield;
  if (data.actualHarvestDate !== undefined) u.actual_harvest_date = data.actualHarvestDate;
  if (data.status !== undefined) u.status = data.status;

  const { error } = await supabase.from("farm_records").update(u).eq("id", id);
  if (error) throw error;
}

export async function deleteFarmRecord(id: string): Promise<void> {
  const { error } = await supabase.from("farm_records").delete().eq("id", id);
  if (error) throw error;
}

// ─── Farm Activities ──────────────────────────────────────────────────────────

export async function fetchFarmActivities(recordId?: string): Promise<DbFarmActivity[]> {
  let query = supabase
    .from("farm_activities")
    .select("*")
    .order("start_time", { ascending: true });

  if (recordId) query = query.eq("farm_record_id", recordId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeActivity);
}

export async function createDbFarmActivity(data: {
  farmRecordId?: string;
  activityType: string;
  title: string;
  notes?: string;
  startTime: string;
  endTime?: string;
  alarmAt?: string;
  inputsUsed?: string;
  estimatedCost?: number;
}): Promise<DbFarmActivity> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: row, error } = await supabase
    .from("farm_activities")
    .insert({
      user_id: userId,
      farm_record_id: data.farmRecordId ?? null,
      activity_type: data.activityType,
      title: data.title,
      notes: data.notes ?? null,
      start_time: data.startTime,
      end_time: data.endTime ?? null,
      alarm_at: data.alarmAt ?? null,
      inputs_used: data.inputsUsed ?? null,
      estimated_cost: data.estimatedCost ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return normalizeActivity(row);
}

export async function completeActivity(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from("farm_activities")
    .update({ is_completed: completed })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDbFarmActivity(id: string): Promise<void> {
  const { error } = await supabase.from("farm_activities").delete().eq("id", id);
  if (error) throw error;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchFarmNotifications(): Promise<FarmNotification[]> {
  const { data, error } = await supabase
    .from("farm_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    notificationType: r.notification_type,
    title: r.title,
    message: r.message,
    relatedRecordId: r.related_record_id ?? undefined,
    isRead: r.is_read,
    createdAt: r.created_at,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("farm_notifications").update({ is_read: true }).eq("id", id);
}

// ─── AI Requests (chat + image diagnosis) ────────────────────────────────────

export async function logAIRequest(data: {
  sessionId: string;
  requestType: "chatbot" | "image_diagnosis";
  mode?: string;
  textQuery?: string;
  imageUrl?: string;
  relatedFarmRecordId?: string;
}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: row, error } = await supabase
    .from("ai_requests")
    .insert({
      user_id: userId,
      session_id: data.sessionId,
      request_type: data.requestType,
      mode: data.mode ?? null,
      text_query: data.textQuery ?? null,
      image_url: data.imageUrl ?? null,
      related_farm_record_id: data.relatedFarmRecordId ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw error;
  return row.id;
}

export async function resolveAIRequest(
  id: string,
  responseText: string,
  aiModel?: string
): Promise<void> {
  await supabase
    .from("ai_requests")
    .update({ response_text: responseText, status: "done", ai_model: aiModel ?? null })
    .eq("id", id);
}

export async function failAIRequest(id: string): Promise<void> {
  await supabase.from("ai_requests").update({ status: "failed" }).eq("id", id);
}

// ─── Media upload ─────────────────────────────────────────────────────────────

export async function uploadFarmMedia(file: File): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("farm-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("farm-media").getPublicUrl(path);
  return data.publicUrl;
}

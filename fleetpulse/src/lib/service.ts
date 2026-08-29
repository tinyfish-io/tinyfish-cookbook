import type { Vehicle, ServiceAnswer } from "./types";
import { SERVICE_FORM_FIELDS } from "./seed";

export function isServiceDue(vehicle: Vehicle): boolean {
  return vehicle.currentMileageKm - vehicle.lastServiceMileageKm >= vehicle.serviceIntervalKm;
}

export function serviceDueReason(vehicle: Vehicle): string {
  const overBy = vehicle.currentMileageKm - vehicle.lastServiceMileageKm - vehicle.serviceIntervalKm;
  return overBy >= 0
    ? `${vehicle.plate} is ${overBy.toLocaleString("vi-VN")} km past its ${vehicle.serviceIntervalKm.toLocaleString("vi-VN")} km service interval (currently ${vehicle.currentMileageKm.toLocaleString("vi-VN")} km, last serviced at ${vehicle.lastServiceMileageKm.toLocaleString("vi-VN")} km).`
    : `Manually requested — ${vehicle.plate} is at ${vehicle.currentMileageKm.toLocaleString("vi-VN")} km, ${(vehicle.serviceIntervalKm - (vehicle.currentMileageKm - vehicle.lastServiceMileageKm)).toLocaleString("vi-VN")} km before its next scheduled interval.`;
}

export async function draftServiceAnswers(vehicle: Vehicle, reason: string): Promise<ServiceAnswer[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return heuristicAnswers(vehicle, reason);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: [
              "You are a fleet operations assistant drafting a vehicle service-booking request to send to a Tasco Auto service center in Vietnam.",
              "You will receive the vehicle details and the reason service is being requested. Fill in each form field factually and concisely, based only on the data given — never invent facts not provided.",
              "The 'reason' field should read like a real internal fleet-maintenance note — plain, factual, no marketing language, no exclamation marks.",
              'Respond with ONLY a raw JSON object: {"answers": [{"fieldId": "plate", "draft": "..."}, ...]} — one entry per field id given.',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              plate: vehicle.plate,
              model: vehicle.name,
              currentMileageKm: vehicle.currentMileageKm,
              reason,
              formFields: SERVICE_FORM_FIELDS.map((f) => ({ id: f.id, label: f.label, type: f.type, helper: f.helper })),
            }),
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!res.ok) return heuristicAnswers(vehicle, reason);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const rawAnswers = Array.isArray(parsed?.answers) ? parsed.answers : [];

    return SERVICE_FORM_FIELDS.map((field) => {
      const match = rawAnswers.find((a: any) => a?.fieldId === field.id);
      return {
        fieldId: field.id,
        label: field.label,
        draft: typeof match?.draft === "string" && match.draft.trim() ? match.draft : heuristicAnswerFor(field.id, vehicle, reason),
        edited: false,
      };
    });
  } catch {
    return heuristicAnswers(vehicle, reason);
  }
}

function heuristicAnswerFor(fieldId: string, vehicle: Vehicle, reason: string): string {
  switch (fieldId) {
    case "plate":
      return vehicle.plate;
    case "model":
      return vehicle.name;
    case "mileage":
      return String(vehicle.currentMileageKm);
    case "serviceType":
      return "Scheduled maintenance";
    case "reason":
      return reason;
    case "preferredDate":
      return "Within the next 7 days";
    default:
      return "";
  }
}

function heuristicAnswers(vehicle: Vehicle, reason: string): ServiceAnswer[] {
  return SERVICE_FORM_FIELDS.map((field) => ({
    fieldId: field.id,
    label: field.label,
    draft: heuristicAnswerFor(field.id, vehicle, reason),
    edited: false,
  }));
}

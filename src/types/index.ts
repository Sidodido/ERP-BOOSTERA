import { Role, ProspectStatus, ClientStatus, OfferType, CallResult, AppointmentType, AppointmentStatus, FollowUpStatus } from "@prisma/client";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  phone?: string | null;
}

export interface ProspectDTO {
  id: string;
  companyName: string;
  contactName?: string | null;
  phone: string;
  email?: string | null;
  sector: string;
  wilaya: string;
  address?: string | null;
  status: ProspectStatus;
  rawState?: string | null;
  prospectionDate?: string | null;
  callStatus?: string | null;
  response?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    calls: number;
    appointments: number;
    followUps: number;
  };
}

export interface ClientDTO {
  id: string;
  companyName: string;
  brandName?: string | null;
  contactName?: string | null;
  phone: string;
  email?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  address?: string | null;
  sector: string;
  wilaya?: string | null;
  status: ClientStatus;
  offerType: OfferType;
  contractStart?: string | null;
  contractEnd?: string | null;
  contractValue: number;
  monthlyFee: number;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CallDTO {
  id: string;
  prospectId?: string | null;
  clientId?: string | null;
  userId: string;
  result: CallResult;
  comment?: string | null;
  durationSeconds?: number | null;
  calledAt: string;
  user?: { id: string; name: string };
  prospect?: { id: string; companyName: string; phone: string } | null;
  client?: { id: string; companyName: string; phone: string } | null;
}

export interface AppointmentDTO {
  id: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  durationMin: number;
  location?: string | null;
  notes?: string | null;
  prospectId?: string | null;
  clientId?: string | null;
  userId: string;
  user?: { id: string; name: string };
  prospect?: { id: string; companyName: string; phone: string } | null;
  client?: { id: string; companyName: string; phone: string } | null;
}

export interface FollowUpDTO {
  id: string;
  prospectId: string;
  userId: string;
  stepNumber: number;
  scheduledAt: string;
  status: FollowUpStatus;
  notes?: string | null;
  completedAt?: string | null;
  prospect: { id: string; companyName: string; phone: string; sector: string };
  user: { id: string; name: string };
}

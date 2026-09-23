export type CorrectiveActionStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_REVIEW'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'REOPENED'
  | 'CANCELLED';

export type CorrectiveActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActionDepartment =
  | 'Branch Manager'
  | 'Operations'
  | 'Maintenance'
  | 'Marketing'
  | 'HR'
  | 'IT'
  | 'Other';

export type RootCauseCategory =
  | 'PROCESS'
  | 'PEOPLE'
  | 'EQUIPMENT'
  | 'FACILITY'
  | 'TRAINING'
  | 'POLICY'
  | 'TECHNOLOGY'
  | 'OTHER';

export type UserRole =
  | 'Evaluator'
  | 'Supervisor'
  | 'Manager'
  | 'Owner'
  | 'Verifier'
  | 'Admin';

export interface EvidencePhoto {
  id: string;
  url: string;
  caption?: string;
  timestamp: string;
  storageKey?: string;
  fileSizeBytes?: number;
  mimeType?: string;
}

export interface ReopenComment {
  id: string;
  comment: string;
  reopenedBy: string;
  timestamp: string;
}

export interface CorrectiveAction {
  id: string;
  tenantId: string;
  findingId: string;
  indicatorCode: string;
  visitId: string;
  branchId: string;
  branchName: string;
  brandName: string;
  title: string;
  description: string;
  priority: CorrectiveActionPriority;
  status: CorrectiveActionStatus;
  owner?: string;
  department: ActionDepartment;
  dueDate: string;
  rootCause?: RootCauseCategory;
  beforePhotos: EvidencePhoto[];
  afterPhotos: EvidencePhoto[];
  resolutionNote?: string;
  completionDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNote?: string;
  reopenCount: number;
  reopenComments: ReopenComment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionAuditLog {
  id: string;
  actionId: string;
  who: string;
  userRole: UserRole;
  what: string;
  fromStatus: string;
  toStatus: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface RolePermissions {
  canCreateFindings: boolean;
  canApproveFindings: boolean;
  canCreateActions: boolean;
  canAssignActions: boolean;
  canUpdateAssignedActions: boolean;
  canResolveActions: boolean;
  canVerifyActions: boolean;
  canReopenActions: boolean;
  canManageSettings: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  Evaluator: {
    canCreateFindings: true,
    canApproveFindings: false,
    canCreateActions: false,
    canAssignActions: false,
    canUpdateAssignedActions: false,
    canResolveActions: false,
    canVerifyActions: true, // Evaluator can verify resolution of findings
    canReopenActions: true,
    canManageSettings: false,
  },
  Supervisor: {
    canCreateFindings: true,
    canApproveFindings: true,
    canCreateActions: true,
    canAssignActions: true,
    canUpdateAssignedActions: false,
    canResolveActions: false,
    canVerifyActions: true,
    canReopenActions: true,
    canManageSettings: false,
  },
  Manager: {
    canCreateFindings: false,
    canApproveFindings: false,
    canCreateActions: true,
    canAssignActions: true,
    canUpdateAssignedActions: true,
    canResolveActions: true,
    canVerifyActions: false, // Managers typically assign, cannot bypass verification
    canReopenActions: true,
    canManageSettings: false,
  },
  Owner: {
    canCreateFindings: false,
    canApproveFindings: false,
    canCreateActions: false,
    canAssignActions: false,
    canUpdateAssignedActions: true,
    canResolveActions: true,
    canVerifyActions: false, // Owner cannot self-verify!
    canReopenActions: false,
    canManageSettings: false,
  },
  Verifier: {
    canCreateFindings: false,
    canApproveFindings: false,
    canCreateActions: false,
    canAssignActions: false,
    canUpdateAssignedActions: false,
    canResolveActions: false,
    canVerifyActions: true,
    canReopenActions: true,
    canManageSettings: false,
  },
  Admin: {
    canCreateFindings: true,
    canApproveFindings: true,
    canCreateActions: true,
    canAssignActions: true,
    canUpdateAssignedActions: true,
    canResolveActions: true,
    canVerifyActions: true,
    canReopenActions: true,
    canManageSettings: true,
  },
};

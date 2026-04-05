import { buildDefaultCategories, defaultResourceLinks } from "@/lib/app-state/defaults";
import type {
  Category,
  InvestmentProfile,
  ResourceLink,
  UserProfile,
} from "@/lib/types";

export type BootstrapState = {
  profile: UserProfile;
  categories: Category[];
  resources: ResourceLink[];
  investmentProfile: InvestmentProfile;
};

export function createBootstrapState(profile: UserProfile): BootstrapState {
  return {
    profile,
    categories: buildDefaultCategories(profile.id),
    resources: defaultResourceLinks,
    investmentProfile: {
      id: `investment-profile:${profile.id}`,
      userId: profile.id,
      timeHorizonMonths: profile.investmentHorizonMonths,
      liquidityNeed: "near_term",
      riskComfort: profile.riskComfort,
      goalFocus: "general_wealth",
      guidanceLevel: "starter",
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  };
}

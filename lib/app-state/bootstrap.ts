import { buildDefaultAccounts } from "@/lib/app-state/default-accounts";
import { buildDefaultCategories, defaultResourceLinks } from "@/lib/app-state/defaults";
import type {
  Account,
  Category,
  InvestmentProfile,
  ResourceLink,
  UserProfile,
} from "@/lib/types";
import { investmentProfileId } from "@/lib/domain/seeded-ids";

export type BootstrapState = {
  profile: UserProfile;
  accounts: Account[];
  categories: Category[];
  resources: ResourceLink[];
  investmentProfile: InvestmentProfile;
};

export function createBootstrapState(profile: UserProfile): BootstrapState {
  return {
    profile,
    accounts: buildDefaultAccounts(profile.id, profile.createdAt),
    categories: buildDefaultCategories(profile.id),
    resources: defaultResourceLinks,
    investmentProfile: {
      id: investmentProfileId(profile.id),
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

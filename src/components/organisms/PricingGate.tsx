"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Plan {
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly limit: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly checkoutUrl: string | undefined;
  readonly featured?: boolean;
  readonly used?: boolean;
}

const PLANS: readonly Plan[] = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    limit: "1 analysis total",
    description: "One free analysis, no card required.",
    features: ["Full clause analysis", "NL labour law", "PDF upload"],
    checkoutUrl: undefined,
    used: true,
  },
  {
    name: "Personal",
    price: "€10",
    period: "/ month",
    limit: "10 PDFs / month",
    description: "For individuals reviewing their own contracts.",
    features: ["Full clause analysis", "NL labour law", "10 PDFs per month", "Email support"],
    checkoutUrl: process.env.NEXT_PUBLIC_SOLVIMON_CHECKOUT_PERSONAL,
  },
  {
    name: "Enterprise 100",
    price: "€49",
    period: "/ month",
    limit: "100 PDFs / month",
    description: "For HR teams and growing businesses.",
    features: ["Full clause analysis", "NL labour law", "100 PDFs per month", "Priority support"],
    checkoutUrl: process.env.NEXT_PUBLIC_SOLVIMON_CHECKOUT_ENTERPRISE_100,
    featured: true,
  },
  {
    name: "Enterprise 250",
    price: "€89",
    period: "/ month",
    limit: "250 PDFs / month",
    description: "For high-volume legal and staffing operations.",
    features: [
      "Full clause analysis",
      "NL labour law",
      "250 PDFs per month",
      "Priority support",
      "Dedicated onboarding",
    ],
    checkoutUrl: process.env.NEXT_PUBLIC_SOLVIMON_CHECKOUT_ENTERPRISE_250,
  },
];

interface PricingGateProps {
  readonly onBack?: () => void;
}

export function PricingGate({ onBack }: PricingGateProps) {
  return (
    <section
      data-testid="pricing-gate"
      className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12"
    >
      <header className="text-center">
        <h1 className="font-semibold tracking-tight" style={{ fontSize: "var(--text-hero)" }}>
          Choose your plan
        </h1>
        <p className="text-muted-foreground mt-2 text-base">
          Your free analysis has been used. Upgrade to keep reviewing contracts.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "flex flex-col",
              plan.used && "opacity-60",
              plan.featured && "ring-primary ring-2",
            )}
          >
            {plan.featured && (
              <div className="bg-primary text-primary-foreground rounded-t-xl py-1 text-center text-xs font-medium">
                Most popular
              </div>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div>
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground ml-1 text-sm">{plan.period}</span>
              </div>
              <p className="text-sm font-medium">{plan.limit}</p>
              <ul className="space-y-1.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="shrink-0 text-green-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.used ? (
                <div className="bg-muted text-muted-foreground w-full rounded-md px-4 py-2 text-center text-sm font-medium">
                  Trial used
                </div>
              ) : (
                <Button
                  className="w-full"
                  variant={plan.featured ? "default" : "outline"}
                  render={
                    <a
                      href={plan.checkoutUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Upgrade to ${plan.name} (opens in new tab)`}
                    />
                  }
                >
                  Get started
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {onBack && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
        </div>
      )}
    </section>
  );
}

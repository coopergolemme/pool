import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const opponentEmail = process.env.E2E_OPPONENT_EMAIL;
const opponentPassword = process.env.E2E_OPPONENT_PASSWORD;

const runId = Date.now();
const player1 = `Jordan-${runId}`;
const player2 = `Casey-${runId}`;

async function signIn(page: any, emailValue: string, passwordValue: string) {
  const authForm = page.getByTestId("auth-form");
  await authForm.getByRole("textbox", { name: "Email" }).fill(emailValue);
  await authForm.getByRole("textbox", { name: "Password" }).fill(passwordValue);
  await authForm.getByRole("button", { name: "Sign In" }).click();
}

async function signUp(page: any) {
  await page.getByRole("button", { name: "Create Account" }).click();
}

async function ensureSignedIn(page: any) {
  await expect(page.getByText(/Signed in as/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
}

async function throwIfErrorVisible(page: any) {
  const error = page.getByText(/Supabase error:/i);
  if ((await error.count()) > 0 && (await error.isVisible())) {
    const message = (await error.textContent()) ?? "Supabase error shown";
    if (message.includes("Opponent account not found")) {
      throw new Error(
        `${message} Ensure the profiles trigger/policies are installed and the opponent has signed up.`
      );
    }
    throw new Error(message);
  }
}

async function ensureAccountExists(browser: any, emailValue: string, passwordValue: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await signIn(page, emailValue, passwordValue);
  const loginError = page.getByText(/Supabase error:/i);
  if (await loginError.isVisible()) {
    const errorText = await loginError.textContent();
    if (errorText?.includes("Invalid login credentials")) {
      await signUp(page);
    }
  }
  await context.close();
}

test("loads and shows signed-out state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pool Game Tracker" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await expect(page.getByText("Sign in to save games to your account.")).toBeVisible();
  const quickAdd = page.getByTestId("quick-add-form");
  await expect(quickAdd.getByRole("textbox", { name: "Player 1" })).toBeDisabled();
  await expect(quickAdd.getByRole("button", { name: "Add Game Result" })).toBeDisabled();
});

test("signs in (or creates account) and adds a game", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD not set");

  await page.goto("/");

  await signIn(page, email as string, password as string);

  const loginError = page.getByText(/Supabase error:/i);
  if (await loginError.isVisible()) {
    const errorText = await loginError.textContent();
    if (errorText?.includes("Invalid login credentials")) {
      await signUp(page);
    } else if (errorText?.includes("Email not confirmed")) {
      test.skip(true, "Email confirmation required; cannot proceed.");
    }
  }

  await ensureSignedIn(page);

  const quickAdd = page.getByTestId("quick-add-form");
  await expect(quickAdd.getByRole("textbox", { name: "Player 1" })).toBeEnabled();
  await quickAdd.getByRole("textbox", { name: "Player 1" }).fill(player1);
  await quickAdd.getByRole("textbox", { name: "Player 2" }).fill(player2);
  await quickAdd.getByRole("button", { name: "Player 1 Wins" }).click();

  await quickAdd.getByRole("button", { name: "Add Game Result" }).click();

  await throwIfErrorVisible(page);
  await expect(page.getByText(`${player1} vs ${player2}`)).toBeVisible();
});

test("can sign out after signing in", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD not set");

  await page.goto("/");
  await signIn(page, email as string, password as string);

  const loginError = page.getByText(/Supabase error:/i);
  if (await loginError.isVisible()) {
    const errorText = await loginError.textContent();
    if (errorText?.includes("Invalid login credentials")) {
      await signUp(page);
    } else if (errorText?.includes("Email not confirmed")) {
      test.skip(true, "Email confirmation required; cannot proceed.");
    }
  }

  await ensureSignedIn(page);
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});

test("blocks linking opponent to self", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD not set");

  await page.goto("/");
  await signIn(page, email as string, password as string);

  const loginError = page.getByText(/Supabase error:/i);
  if (await loginError.isVisible()) {
    const errorText = await loginError.textContent();
    if (errorText?.includes("Invalid login credentials")) {
      await signUp(page);
    } else if (errorText?.includes("Email not confirmed")) {
      test.skip(true, "Email confirmation required; cannot proceed.");
    }
  }

  await ensureSignedIn(page);
  const quickAdd = page.getByTestId("quick-add-form");
  await quickAdd.getByRole("textbox", { name: "Player 1" }).fill(`Self-${runId}`);
  await quickAdd.getByRole("textbox", { name: "Player 2" }).fill(`SelfOpp-${runId}`);
  await quickAdd.getByRole("button", { name: "Player 1 Wins" }).click();
  await quickAdd.getByRole("textbox", { name: "Opponent Email (optional)" }).fill(email as string);
  await quickAdd.getByRole("button", { name: "Add Game Result" }).click();

  await expect(page.getByText("Opponent email cannot be your own.")).toBeVisible();
});

test("shows error when opponent email is not found", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL/E2E_PASSWORD not set");

  await page.goto("/");
  await signIn(page, email as string, password as string);

  const loginError = page.getByText(/Supabase error:/i);
  if (await loginError.isVisible()) {
    const errorText = await loginError.textContent();
    if (errorText?.includes("Invalid login credentials")) {
      await signUp(page);
    } else if (errorText?.includes("Email not confirmed")) {
      test.skip(true, "Email confirmation required; cannot proceed.");
    }
  }

  await ensureSignedIn(page);
  const quickAdd = page.getByTestId("quick-add-form");
  await quickAdd.getByRole("textbox", { name: "Player 1" }).fill(`Ghost-${runId}`);
  await quickAdd.getByRole("textbox", { name: "Player 2" }).fill(`Missing-${runId}`);
  await quickAdd.getByRole("button", { name: "Player 1 Wins" }).click();
  await quickAdd
    .getByRole("textbox", { name: "Opponent Email (optional)" })
    .fill(`nobody-${runId}@example.com`);
  await quickAdd.getByRole("button", { name: "Add Game Result" }).click();

  await expect(page.getByText("Opponent account not found. Ask them to sign up first.")).toBeVisible();
});

test("links opponent account if provided", async ({ page, browser }) => {
  test.skip(!email || !password || !opponentEmail || !opponentPassword, "Missing E2E opponent credentials");

  await ensureAccountExists(browser, opponentEmail as string, opponentPassword as string);

  await page.goto("/");
  await signIn(page, email as string, password as string);

  const loginError = page.getByText(/Supabase error:/i);
  if (await loginError.isVisible()) {
    const errorText = await loginError.textContent();
    if (errorText?.includes("Invalid login credentials")) {
      await signUp(page);
    } else if (errorText?.includes("Email not confirmed")) {
      test.skip(true, "Email confirmation required; cannot proceed.");
    }
  }

  await ensureSignedIn(page);

  const opp1 = `Alex-${runId}`;
  const opp2 = `Riley-${runId}`;

  const quickAdd = page.getByTestId("quick-add-form");
  await quickAdd.getByRole("textbox", { name: "Player 1" }).fill(opp1);
  await quickAdd.getByRole("textbox", { name: "Player 2" }).fill(opp2);
  await quickAdd.getByRole("button", { name: "Player 1 Wins" }).click();
  await quickAdd.getByRole("textbox", { name: "Opponent Email (optional)" }).fill(opponentEmail as string);

  await quickAdd.getByRole("button", { name: "Add Game Result" }).click();

  await throwIfErrorVisible(page);
  await expect(page.getByText(`${opp1} vs ${opp2}`)).toBeVisible();
});

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { getMyProfile } from "@/services/api/users";
import type { AuthUser, UserProfile } from "@/lib/auth/types";

type ProfileStatus = "idle" | "loading" | "succeeded" | "failed" | "signedOut";
interface AuthState {
  user: UserProfile | null;
  status: ProfileStatus;
  error: string | null;
  profileRequestId: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
  profileRequestId: null,
};

export const fetchProfile = createAsyncThunk(
  "auth/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      return await getMyProfile();
    } catch {
      return rejectWithValue("Unable to load your profile.");
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { auth: AuthState };
      return state.auth.status === "idle";
    },
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearProfile: () => ({ ...initialState, status: "signedOut" as const }),
    setAuthenticatedUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = {
        ...action.payload,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      };
      state.status = "idle";
      state.error = null;
      state.profileRequestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state, action) => {
        if (state.status === "signedOut") return;
        state.status = "loading";
        state.error = null;
        state.profileRequestId = action.meta.requestId;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        if (
          state.status === "signedOut" ||
          state.profileRequestId !== action.meta.requestId
        ) {
          return;
        }
        state.status = "succeeded";
        state.user = action.payload;
        state.profileRequestId = null;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        if (
          state.status === "signedOut" ||
          state.profileRequestId !== action.meta.requestId
        ) {
          return;
        }
        state.status = "failed";
        state.profileRequestId = null;
        state.error =
          (action.payload as string | undefined) ??
          "Unable to load your profile.";
      });
  },
});

export const { clearProfile, setAuthenticatedUser } = authSlice.actions;
export default authSlice.reducer;

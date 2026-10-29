import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getMyProfile } from "@/services/api/users";
import type { UserProfile } from "@/lib/auth/types";

type ProfileStatus = "idle" | "loading" | "succeeded" | "failed";
interface AuthState {
  user: UserProfile | null;
  status: ProfileStatus;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
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
      return state.auth.status !== "loading" && !state.auth.user;
    },
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearProfile: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.status = "failed";
        state.error = (action.payload as string | undefined) ?? "Unable to load your profile.";
      });
  },
});

export const { clearProfile } = authSlice.actions;
export default authSlice.reducer;

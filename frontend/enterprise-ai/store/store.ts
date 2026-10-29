import { configureStore } from "@reduxjs/toolkit";
import documentsReducer from "./documentsSlice";
import authReducer from "./authSlice";
export const store = configureStore({
  reducer: { documents: documentsReducer, auth: authReducer },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

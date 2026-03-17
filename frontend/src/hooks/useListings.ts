import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Listing } from "../types/listing";
import { JobStatus, JobStatusValue } from "../types/jobStatus";

export const PENDING_KEY = ["listings", JobStatus.PENDING] as const;

export function usePendingListings() {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: async () => {
      const res = await axios.get<Listing[]>("/api/listings", {
        params: { status: JobStatus.PENDING },
      });
      return res.data;
    },
    refetchInterval: 60_000, // poll every 60 s to catch new scrape results
  });
}

export function useUpdateListingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: JobStatusValue }) => {
      const res = await axios.patch<Listing>(`/api/listings/${id}`, { status });
      return res.data;
    },

    // Optimistically remove the card so the UI is instant
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: PENDING_KEY });
      const previous = queryClient.getQueryData<Listing[]>(PENDING_KEY);
      queryClient.setQueryData<Listing[]>(PENDING_KEY, (old) =>
        old?.filter((l) => l.id !== id) ?? []
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PENDING_KEY, context.previous);
      }
    },

    // Keep minimal invalidation — only revalidate after the mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_KEY });
    },
  });
}

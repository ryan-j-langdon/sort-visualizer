#include "sort.h"

#include <algorithm>

namespace {

void record_compare(SortResult& result, int i, int j) {
    result.steps.push_back({StepType::Compare, i, j});
    result.comparisons++;
}

void record_swap(std::vector<int>& arr, SortResult& result, int i, int j) {
    std::swap(arr[i], arr[j]);
    result.steps.push_back({StepType::Swap, i, j});
    result.swaps++;
}

void record_overwrite(std::vector<int>& arr, SortResult& result, int i, int value) {
    arr[i] = value;
    result.steps.push_back({StepType::Overwrite, i, -1, value});
}

void record_sorted(SortResult& result, int i) {
    result.steps.push_back({StepType::SetSorted, i});
}

void merge_sort_rec(std::vector<int>& arr, SortResult& result, int lo, int hi, std::vector<int>& buffer) {
    if (hi - lo <= 1) return;
    int mid = lo + (hi - lo) / 2;
    merge_sort_rec(arr, result, lo, mid, buffer);
    merge_sort_rec(arr, result, mid, hi, buffer);

    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) {
        record_compare(result, i, j);
        if (arr[i] <= arr[j]) buffer[k++] = arr[i++];
        else buffer[k++] = arr[j++];
    }
    while (i < mid) buffer[k++] = arr[i++];
    while (j < hi) buffer[k++] = arr[j++];

    for (int p = lo; p < hi; p++) {
        record_overwrite(arr, result, p, buffer[p]);
    }
}

void quick_sort_rec(std::vector<int>& arr, SortResult& result, int lo, int hi) {
    if (lo > hi) return;
    if (lo == hi) {
        record_sorted(result, lo);
        return;
    }

    int pivot = arr[hi];
    int i = lo;
    for (int j = lo; j < hi; j++) {
        record_compare(result, j, hi);
        if (arr[j] < pivot) {
            if (i != j) record_swap(arr, result, i, j);
            i++;
        }
    }
    if (i != hi) record_swap(arr, result, i, hi);
    record_sorted(result, i);

    quick_sort_rec(arr, result, lo, i - 1);
    quick_sort_rec(arr, result, i + 1, hi);
}

void sift_down(std::vector<int>& arr, SortResult& result, int start, int end) {
    int root = start;
    while (2 * root + 1 <= end) {
        int child = 2 * root + 1;
        int swap_idx = root;

        record_compare(result, swap_idx, child);
        if (arr[swap_idx] < arr[child]) swap_idx = child;

        if (child + 1 <= end) {
            record_compare(result, swap_idx, child + 1);
            if (arr[swap_idx] < arr[child + 1]) swap_idx = child + 1;
        }

        if (swap_idx == root) return;
        record_swap(arr, result, root, swap_idx);
        root = swap_idx;
    }
}

} // namespace

SortResult run_bubble_sort(std::vector<int> arr) {
    SortResult result;
    result.initial = arr;
    int n = (int)arr.size();
    if (n == 0) return result;

    int end = n - 1;
    while (end > 0) {
        bool swapped = false;
        for (int i = 0; i < end; i++) {
            record_compare(result, i, i + 1);
            if (arr[i] > arr[i + 1]) {
                record_swap(arr, result, i, i + 1);
                swapped = true;
            }
        }
        record_sorted(result, end);
        end--;
        if (!swapped) break;
    }
    for (int i = end; i >= 0; i--) record_sorted(result, i);
    return result;
}

SortResult run_insertion_sort(std::vector<int> arr) {
    SortResult result;
    result.initial = arr;
    int n = (int)arr.size();
    if (n == 0) return result;

    record_sorted(result, 0);
    for (int i = 1; i < n; i++) {
        int j = i;
        while (j > 0) {
            record_compare(result, j - 1, j);
            if (arr[j - 1] > arr[j]) {
                record_swap(arr, result, j - 1, j);
                j--;
            } else {
                break;
            }
        }
        record_sorted(result, i);
    }
    return result;
}

SortResult run_selection_sort(std::vector<int> arr) {
    SortResult result;
    result.initial = arr;
    int n = (int)arr.size();

    for (int i = 0; i < n; i++) {
        int min_idx = i;
        for (int j = i + 1; j < n; j++) {
            record_compare(result, min_idx, j);
            if (arr[j] < arr[min_idx]) min_idx = j;
        }
        if (min_idx != i) record_swap(arr, result, i, min_idx);
        record_sorted(result, i);
    }
    return result;
}

SortResult run_merge_sort(std::vector<int> arr) {
    SortResult result;
    result.initial = arr;
    int n = (int)arr.size();
    std::vector<int> buffer(n);
    merge_sort_rec(arr, result, 0, n, buffer);
    for (int i = 0; i < n; i++) record_sorted(result, i);
    return result;
}

SortResult run_quick_sort(std::vector<int> arr) {
    SortResult result;
    result.initial = arr;
    int n = (int)arr.size();
    if (n > 0) quick_sort_rec(arr, result, 0, n - 1);
    return result;
}

SortResult run_heap_sort(std::vector<int> arr) {
    SortResult result;
    result.initial = arr;
    int n = (int)arr.size();
    if (n == 0) return result;

    for (int start = n / 2 - 1; start >= 0; start--) {
        sift_down(arr, result, start, n - 1);
    }
    for (int end = n - 1; end > 0; end--) {
        record_swap(arr, result, 0, end);
        record_sorted(result, end);
        sift_down(arr, result, 0, end - 1);
    }
    record_sorted(result, 0);
    return result;
}

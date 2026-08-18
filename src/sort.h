#pragma once

#include <vector>

enum class StepType { Compare, Swap, Overwrite, SetSorted };

struct Step {
    StepType type;
    int i;
    int j = -1;
    int value_i = -1;   // used by Overwrite steps (merge sort's write-back phase)
};

struct SortResult {
    std::vector<int> initial;
    std::vector<Step> steps;
    int comparisons = 0;
    int swaps = 0;
};

SortResult run_bubble_sort(std::vector<int> arr);
SortResult run_insertion_sort(std::vector<int> arr);
SortResult run_selection_sort(std::vector<int> arr);
SortResult run_merge_sort(std::vector<int> arr);
SortResult run_quick_sort(std::vector<int> arr);
SortResult run_heap_sort(std::vector<int> arr);

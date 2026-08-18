#include <emscripten/bind.h>

#include "sort.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(sort_module) {
    enum_<StepType>("StepType")
        .value("Compare", StepType::Compare)
        .value("Swap", StepType::Swap)
        .value("Overwrite", StepType::Overwrite)
        .value("SetSorted", StepType::SetSorted);

    value_object<Step>("Step")
        .field("type", &Step::type)
        .field("i", &Step::i)
        .field("j", &Step::j)
        .field("value_i", &Step::value_i);

    value_object<SortResult>("SortResult")
        .field("initial", &SortResult::initial)
        .field("steps", &SortResult::steps)
        .field("comparisons", &SortResult::comparisons)
        .field("swaps", &SortResult::swaps);

    register_vector<int>("VectorInt");
    register_vector<Step>("VectorStep");

    function("run_bubble_sort", &run_bubble_sort);
    function("run_insertion_sort", &run_insertion_sort);
    function("run_selection_sort", &run_selection_sort);
    function("run_merge_sort", &run_merge_sort);
    function("run_quick_sort", &run_quick_sort);
    function("run_heap_sort", &run_heap_sort);
}

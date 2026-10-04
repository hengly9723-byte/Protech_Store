import React from "react";

const StarRating = ({ rating = 0, max = 5, size = "text-sm", onChange = null }) => {
  const stars = [];

  for (let i = 1; i <= max; i++) {
    const isInteractive = typeof onChange === "function";
    const isFilled = i <= rating;
    const isHalf = !isFilled && i - 0.5 <= rating;

    stars.push(
      <button
        key={i}
        type="button"
        disabled={!isInteractive}
        onClick={() => isInteractive && onChange(i)}
        className={`${size} ${
          isInteractive ? "cursor-pointer hover:scale-110 transition-transform p-0.5" : "cursor-default"
        } ${
          isFilled
            ? "text-amber-400"
            : isHalf
            ? "text-amber-400"
            : "text-gray-300"
        }`}
      >
        <i
          className={`bi ${
            isFilled
              ? "bi-star-fill"
              : isHalf
              ? "bi-star-half"
              : "bi-star"
          }`}
        />
      </button>
    );
  }

  return <div className="inline-flex items-center gap-0.5">{stars}</div>;
};

export default StarRating;

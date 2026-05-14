import React, { useState } from "react";
import {
    Box,
    Rating,
    Typography,
} from "@mui/material";
// import { Favorite, FavoriteBorder } from "@mui/icons-material";

export default function StarRatingField({ label = "Rate Your Experience", onChangeExtented = undefined }) {
    const [form, setForm] = useState({ rating: 0 });
    const [hover, setHover] = useState(-1);

    const labels = {
        1: "Bad",
        2: "Poor",
        3: "Average",
        4: "Good",
        5: "Excellent"
    };

    const handleChange = (e, newValue) => {
        setForm((prev) => ({ ...prev, rating: newValue }));
        onChangeExtented?.(newValue);
    };

    return (
        <Box
            sx={{
                mx: "auto",
                mt: 6,
            }}
        >
            <Typography
                variant="h6"
                textAlign="center"
                sx={{ mb: 2 }}
            >
                {label}
            </Typography>

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <Rating
                    name="rating"
                    value={form.rating}
                    // precision={0.5} // uncomment for half-star ratings
                    max={5}
                    size="large"
                    onChange={handleChange}
                    onChangeActive={(e, newHover) => setHover(newHover)}
                // icon={<Favorite fontSize="inherit" color="error" />}
                // emptyIcon={<FavoriteBorder fontSize="inherit" />}
                />

                <Typography variant="body2" color="text.secondary">
                    {labels[hover !== -1 ? hover : form.rating] ||
                        "Click a star to rate"}
                </Typography>
            </Box>
        </Box>
    );
}

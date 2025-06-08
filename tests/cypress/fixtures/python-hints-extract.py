# This script processes the AI hint CSV files.
# It finds the hint in each row by taking the last column that has content
# These are then output to a Markdown text file, with a specially formatted heading
# before each hint with its details.
import csv
import os
import sys
# Iterate over all CSV files in the current directory
for filename in os.listdir("."):
    if filename.endswith(".csv"):
        # Get the base name without extension
        basename = os.path.splitext(filename)[0]

        result = []
        with open(filename,'r',encoding="utf8") as f:
            reader = csv.reader(f)
            # skip the headers
            next(reader,None)
            for row in reader:
                # Find the index of the last non-empty cell in the row, excluding the last one for the model files:
                if filename.startswith("Human"):
                    rindex = len(row)-1
                else:
                    rindex = len(row)-2
                while rindex>=0 and (( not row[rindex].strip()) or row[rindex].strip()=="NA"):
                    rindex = rindex-1

                if rindex<0:
                    # Skip rows with no non-empty cells
                    continue

                if filename.startswith("Human"):
                    header = "# "+basename+" $$$ "+row[0]
                else:
                    header = "# "+basename+" $$$ Prompt"+row[0]+" $$$ "+row[1]

                result.append(header+"\n"+row[rindex])

        # Output the result to a text file with the same name stem
        with open("raw-"+basename+".md","w",encoding="utf8") as f:
            f.write("\n\n".join(result))

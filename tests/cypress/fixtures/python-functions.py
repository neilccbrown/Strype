# Adapted from Neil's side project so no issues with licensing:
# The only concession from the original is to add spaces around all operators to
# match what our code generation does (hence weird spacing around commas and dots):
def availability (name , checked_buildings):
    if name in cached_availability:
        return cached_availability[name]

    best = Availability . never_available
    # Farm fields don't have a collector, they are implicitly available to buildings that consume them:
    if name == FARM_FIELD:
        if name in resources:
            return Availability . available
        else:
            return Availability . never_available

    # Check if we have a raw collector for that resource:
    if name in resources:
        for building_name , recipes in BUILDINGS_TO_RECIPES . items():
            for recipe in recipes:
                if not isinstance(recipe , tuple) and recipe == name:
                    if building_name in available_buildings:
                        best = max(best , Availability . available)
                    elif building_name in available_blueprints:
                        best = max(best , Availability . with_blueprint)

    # Check if currently craftable all the way down
    # Start by looking through all buildings and all recipes to find end product:
    checked_buildings = checked_buildings . copy()
    for building_name , recipes in BUILDINGS_TO_RECIPES . items():
        for recipe in recipes:
            # Only look at production buildings, not raw gatherers (which are already checked above):
            if isinstance(recipe , tuple):
                # Check RHS (outcome):
                if recipe[1][1] == name:
                    if (building_name , name) in checked_buildings:
                        continue
                    else:
                        checked_buildings . append((building_name , name))
                    # It's a recipe for the good we want!
                    # Go through LHS (ingredients):
                    recipe_input_availability = input_availability(recipe[0] , checked_buildings)
                    if recipe_input_availability == Availability . never_available:
                        pass
                    elif recipe_input_availability == Availability . with_blueprint:
                        best = max(best , Availability . with_blueprint)
                    else:
                        if building_name in available_buildings:
                            best = max(best , recipe_input_availability)
                        elif building_name in available_blueprints:
                            best = max(best , Availability . with_blueprint)
    cached_availability[name] = best
    return best
